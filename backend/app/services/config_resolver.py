"""Resolve default model configuration from DB only."""
import os
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ModelConfig, ModelProvider

logger = logging.getLogger(__name__)

# Mapping: model_type → os.environ key names (used only for sync_to_env)
MODEL_TYPE_ENV_MAP = {
    "chat": {"api_key": "LLM_API_KEY", "base_url": "LLM_BASE_URL", "model": "LLM_MODEL"},
    "embedding": {"api_key": "EMBEDDING_API_KEY", "base_url": "EMBEDDING_BASE_URL", "model": "EMBEDDING_MODEL", "max_tokens": "EMBEDDING_MAX_TOKENS"},
    "rerank": {"api_key": "RERANKER_API_KEY", "base_url": "RERANKER_BASE_URL", "model": "RERANKER_MODEL"},
    "asr": {"api_key": "ASR_API_KEY", "base_url": "ASR_BASE_URL", "model": "ASR_MODEL"},
}


async def get_default_config(model_type: str, session: AsyncSession) -> dict | None:
    """Get default model config for a type from DB only."""
    result = await session.execute(
        select(ModelConfig)
        .where(ModelConfig.model_type == model_type, ModelConfig.is_default == True, ModelConfig.enabled == True)
    )
    mc = result.scalar_one_or_none()
    if not mc:
        return None
    provider = await session.get(ModelProvider, mc.provider_id)
    if not provider or not provider.enabled:
        return None
    return {"api_key": provider.api_key, "base_url": provider.base_url, "model": mc.model_name, "max_tokens": mc.max_tokens}


async def get_all_defaults(session: AsyncSession) -> dict:
    result = {}
    for mt in ("chat", "embedding", "rerank", "asr"):
        result[mt] = await get_default_config(mt, session)
    return result


async def sync_model_defaults_to_env(session: AsyncSession) -> None:
    """Sync default model configs from DB to os.environ so existing services pick them up."""
    result = await session.execute(
        select(ModelConfig).where(ModelConfig.is_default == True, ModelConfig.enabled == True)
    )
    defaults = result.scalars().all()
    synced = 0
    for mc in defaults:
        provider = await session.get(ModelProvider, mc.provider_id)
        if not provider or not provider.enabled:
            continue
        env_map = MODEL_TYPE_ENV_MAP.get(mc.model_type)
        if not env_map:
            continue
        os.environ[env_map["api_key"]] = provider.api_key
        os.environ[env_map["base_url"]] = provider.base_url
        os.environ[env_map["model"]] = mc.model_name
        if "max_tokens" in env_map:
            os.environ[env_map["max_tokens"]] = str(mc.max_tokens)
        synced += 1
    if synced:
        logger.info(f"Synced {synced} model defaults to os.environ")
