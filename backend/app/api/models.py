"""Model management API: providers, model configs, defaults, verification."""
import logging

from fastapi import APIRouter, Depends, HTTPException
from openai import AsyncOpenAI, OpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.deps import require_role
from app.db.engine import get_session
from app.db.models import ModelProvider, ModelConfig, User
from app.api.schemas import (
    AddProviderRequest, UpdateProviderRequest, AddModelRequest, SetDefaultRequest,
)
from app.services.model_registry import get_provider_types, get_provider_info
from app.services.config_resolver import sync_model_defaults_to_env

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/models", tags=["models"])
require_admin = require_role("admin")


# --- Available providers ---

@router.get("/available-providers")
async def list_available_providers(
    _current_user: User = Depends(require_admin),
):
    return get_provider_types()


# --- Providers CRUD ---

@router.get("/providers")
async def list_providers(
    _current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(ModelProvider).options(selectinload(ModelProvider.models)).order_by(ModelProvider.created_at.desc())
    )
    providers = result.scalars().all()
    out = []
    for p in providers:
        out.append({
            "id": p.id,
            "name": p.name,
            "provider_type": p.provider_type,
            "api_key": p.api_key[:8] + "..." if len(p.api_key) > 8 else p.api_key,
            "api_key_full": p.api_key,
            "base_url": p.base_url,
            "enabled": p.enabled,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "models": [
                {
                    "id": m.id,
                    "provider_id": m.provider_id,
                    "model_name": m.model_name,
                    "model_type": m.model_type,
                    "enabled": m.enabled,
                    "is_default": m.is_default,
                    "max_tokens": m.max_tokens,
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                }
                for m in p.models
            ],
        })
    return out


@router.post("/providers")
async def add_provider(
    req: AddProviderRequest,
    _current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    info = get_provider_info(req.provider_type)
    if not info:
        raise HTTPException(status_code=400, detail=f"Unknown provider type: {req.provider_type}")

    provider = ModelProvider(
        name=info["name"],
        provider_type=req.provider_type,
        api_key=req.api_key,
        base_url=req.base_url or info["default_base_url"],
    )
    session.add(provider)
    await session.commit()
    await session.refresh(provider)
    return {"id": provider.id, "name": provider.name, "provider_type": provider.provider_type}


@router.put("/providers/{provider_id}")
async def update_provider(
    provider_id: int,
    req: UpdateProviderRequest,
    _current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    provider = await session.get(ModelProvider, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    if req.api_key is not None:
        provider.api_key = req.api_key
    if req.base_url is not None:
        provider.base_url = req.base_url
    if req.enabled is not None:
        provider.enabled = req.enabled

    await session.commit()
    return {"status": "updated"}


@router.delete("/providers/{provider_id}")
async def delete_provider(
    provider_id: int,
    _current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    provider = await session.get(ModelProvider, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    await session.delete(provider)
    await session.commit()
    return {"status": "deleted"}


# --- Verification ---

@router.post("/providers/{provider_id}/verify")
async def verify_provider(
    provider_id: int,
    _current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    provider = await session.get(ModelProvider, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    info = get_provider_info(provider.provider_type)
    supported = info.get("supported_types", []) if info else []
    errors = []
    tested = []

    # Test chat/embedding via OpenAI-compatible API
    if "chat" in supported:
        try:
            client = AsyncOpenAI(api_key=provider.api_key, base_url=provider.base_url)
            resp = await client.chat.completions.create(
                model=info["models"][0]["name"] if info else "gpt-4",
                messages=[{"role": "user", "content": "Hi"}],
                max_tokens=5,
            )
            tested.append("chat")
        except Exception as e:
            errors.append(f"chat: {e}")

    if "embedding" in supported:
        try:
            client = OpenAI(api_key=provider.api_key, base_url=provider.base_url)
            model_name = next((m["name"] for m in (info.get("models", [])) if m["type"] == "embedding"), "text-embedding-3-small")
            client.embeddings.create(model=model_name, input=["test"])
            tested.append("embedding")
        except Exception as e:
            errors.append(f"embedding: {e}")

    if "rerank" in supported:
        try:
            import requests
            model_name = next((m["name"] for m in (info.get("models", [])) if m["type"] == "rerank"), "BAAI/bge-reranker-v2-m3")
            resp = requests.post(
                f"{provider.base_url}/rerank",
                headers={"Authorization": f"Bearer {provider.api_key}", "Content-Type": "application/json"},
                json={"model": model_name, "query": "test", "documents": ["hello"], "top_n": 1},
                timeout=10,
            )
            resp.raise_for_status()
            tested.append("rerank")
        except Exception as e:
            errors.append(f"rerank: {e}")

    if not supported:
        return {"valid": False, "error": "No supported model types to verify", "tested": []}

    return {
        "valid": len(errors) == 0,
        "error": "; ".join(errors) if errors else None,
        "tested": tested,
    }


# --- Model configs ---

@router.post("/providers/{provider_id}/models")
async def add_model(
    provider_id: int,
    req: AddModelRequest,
    _current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    provider = await session.get(ModelProvider, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    if req.is_default:
        await session.execute(
            select(ModelConfig)
            .where(ModelConfig.model_type == req.model_type, ModelConfig.is_default == True)
        )
        result = await session.execute(
            select(ModelConfig).where(
                ModelConfig.model_type == req.model_type, ModelConfig.is_default == True
            )
        )
        for old in result.scalars().all():
            old.is_default = False

    mc = ModelConfig(
        provider_id=provider_id,
        model_name=req.model_name,
        model_type=req.model_type,
        max_tokens=req.max_tokens,
        is_default=req.is_default,
    )
    session.add(mc)
    await session.commit()
    await session.refresh(mc)

    if req.is_default:
        await sync_model_defaults_to_env(session)

    return {"id": mc.id, "model_name": mc.model_name, "is_default": mc.is_default}


@router.delete("/providers/{provider_id}/models/{model_id}")
async def delete_model(
    provider_id: int,
    model_id: int,
    _current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    mc = await session.get(ModelConfig, model_id)
    if not mc or mc.provider_id != provider_id:
        raise HTTPException(status_code=404, detail="Model config not found")

    was_default = mc.is_default
    await session.delete(mc)
    await session.commit()

    if was_default:
        await sync_model_defaults_to_env(session)

    return {"status": "deleted"}


@router.put("/configs/{model_id}/toggle")
async def toggle_model(
    model_id: int,
    _current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    mc = await session.get(ModelConfig, model_id)
    if not mc:
        raise HTTPException(status_code=404, detail="Model config not found")

    mc.enabled = not mc.enabled
    await session.commit()

    if mc.is_default:
        await sync_model_defaults_to_env(session)

    return {"id": mc.id, "enabled": mc.enabled}


# --- System defaults ---

@router.get("/defaults")
async def get_defaults(
    _current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    from app.services.config_resolver import get_all_defaults
    return await get_all_defaults(session)


@router.put("/defaults")
async def set_defaults(
    req: SetDefaultRequest,
    _current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    mc = await session.get(ModelConfig, req.model_id)
    if not mc:
        raise HTTPException(status_code=404, detail="Model config not found")
    if mc.model_type != req.model_type:
        raise HTTPException(status_code=400, detail="Model type mismatch")

    result = await session.execute(
        select(ModelConfig).where(ModelConfig.model_type == req.model_type, ModelConfig.is_default == True)
    )
    for old in result.scalars().all():
        old.is_default = False

    mc.is_default = True
    mc.enabled = True
    await session.commit()
    await sync_model_defaults_to_env(session)

    return {"status": "updated", "model_type": req.model_type, "model_id": req.model_id}
