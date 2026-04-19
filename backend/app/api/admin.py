"""Admin routes: user management, system stats, settings."""
import json
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import require_role
from app.auth.jwt import hash_password
from app.db.engine import get_session, async_session
from app.db.models import User, Document, Assignment, Submission, Setting
from app.api.schemas import (
    CreateUserRequest, UpdateUserRequest, UserResponse,
    BatchStudentRequest, BatchImportResult,
    SystemStats, SettingItem, SettingUpdate,
)

router = APIRouter(prefix="/admin", tags=["admin"])
require_admin = require_role("admin")


@router.post("/users", response_model=UserResponse)
async def create_user(
    req: CreateUserRequest,
    current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    existing = await session.execute(select(User).where(User.username == req.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already exists")

    if req.student_id:
        dup = await session.execute(select(User).where(User.student_id == req.student_id))
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Student ID already exists")

    user = User(
        username=req.username,
        password_hash="",
        role=req.role,
        is_registered=False,
        real_name=req.real_name,
        student_id=req.student_id,
        class_name=req.class_name,
        email=req.email,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@router.post("/users/batch", response_model=BatchImportResult)
async def batch_import_students(
    req: BatchStudentRequest,
    current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    success_count = 0
    failed = []
    created_ids = []

    for i, s in enumerate(req.students):
        try:
            existing = await session.execute(select(User).where(User.username == s.username))
            if existing.scalar_one_or_none():
                failed.append({"index": i, "username": s.username, "reason": "username exists"})
                continue

            dup = await session.execute(select(User).where(User.student_id == s.student_id))
            if dup.scalar_one_or_none():
                failed.append({"index": i, "username": s.username, "reason": "student_id exists"})
                continue

            user = User(
                username=s.username,
                password_hash="",
                role="student",
                is_registered=False,
                real_name=s.real_name,
                student_id=s.student_id,
                class_name=s.class_name,
            )
            session.add(user)
            await session.flush()
            created_ids.append(user.id)
            success_count += 1
        except Exception as e:
            failed.append({"index": i, "username": s.username, "reason": str(e)})

    await session.commit()
    return BatchImportResult(success_count=success_count, failed=failed, created_ids=created_ids)


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    role: str | None = None,
    class_name: str | None = None,
    current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    stmt = select(User)
    if role:
        stmt = stmt.where(User.role == role)
    if class_name:
        stmt = stmt.where(User.class_name == class_name)
    result = await session.execute(stmt.order_by(User.id))
    return result.scalars().all()


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    req: UpdateUserRequest,
    current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if req.real_name is not None:
        user.real_name = req.real_name
    if req.class_name is not None:
        user.class_name = req.class_name
    if req.password is not None:
        user.password_hash = hash_password(req.password)

    await session.commit()
    await session.refresh(user)
    return user


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await session.delete(user)
    await session.commit()
    return {"status": "deleted"}


@router.get("/stats", response_model=SystemStats)
async def system_stats(
    current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    users = await session.scalar(select(func.count(User.id)))
    docs = await session.scalar(select(func.count(Document.id)))
    assignments = await session.scalar(select(func.count(Assignment.id)))
    submissions = await session.scalar(select(func.count(Submission.id)))
    return SystemStats(
        total_users=users or 0,
        total_documents=docs or 0,
        total_assignments=assignments or 0,
        total_submissions=submissions or 0,
    )


# --- Settings (Phase 5 merged) ---

@router.get("/settings")
async def list_settings(
    current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Setting).order_by(Setting.category, Setting.key))
    settings = result.scalars().all()

    grouped: dict[str, list[dict]] = defaultdict(list)
    for s in settings:
        grouped[s.category].append(SettingItem.model_validate(s).model_dump())
    return dict(grouped)


@router.put("/settings/{key}", response_model=SettingItem)
async def update_setting(
    key: str,
    req: SettingUpdate,
    current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Setting).where(Setting.key == key))
    setting = result.scalar_one_or_none()
    if not setting:
        from app.services.settings_service import DEFAULTS
        category = next((c for c, k, _ in DEFAULTS if k == key), "general")
        setting = Setting(key=key, value=req.value, category=category)
        session.add(setting)
    else:
        setting.value = req.value

    await session.commit()
    await session.refresh(setting)

    from app.services.settings_service import sync_to_env
    sync_to_env(key, req.value)

    return setting
