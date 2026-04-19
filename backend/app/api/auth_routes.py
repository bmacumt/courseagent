"""Auth routes: login, register, send-code, reset-password, current user."""
import asyncio
import logging
import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.auth.jwt import create_access_token, verify_password, hash_password
from app.config import SMTP_HOST
from app.db.engine import get_session
from app.db.models import User
from app.api.schemas import (
    LoginRequest, RegisterRequest, SendCodeRequest, ResetPasswordRequest,
    ChangeEmailRequest, TokenResponse, UserResponse,
)
from app.services.email_service import send_verification_email
from app.services.verification import verification_store

logger = logging.getLogger(__name__)
router = APIRouter(tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(User).where(User.username == req.username))
    user = result.scalar_one_or_none()
    if not user or not user.is_registered or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")

    token = create_access_token(data={"sub": user.username, "role": user.role})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/auth/send-code")
async def send_code(req: SendCodeRequest, session: AsyncSession = Depends(get_session)):
    """Send a 6-digit verification code to email."""
    if req.purpose == "register":
        existing = await session.execute(select(User).where(User.email == req.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="该邮箱已被注册")

    elif req.purpose == "reset_password":
        existing = await session.execute(select(User).where(User.email == req.email))
        if not existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="该邮箱未注册")

    elif req.purpose == "change_email":
        existing = await session.execute(select(User).where(User.email == req.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="该邮箱已被使用")

    code = verification_store.generate_code(req.purpose, req.email)
    if code is None:
        raise HTTPException(status_code=429, detail="发送过于频繁，请1分钟后重试")

    try:
        await asyncio.to_thread(send_verification_email, req.email, code, req.purpose)
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        raise HTTPException(status_code=500, detail="邮件发送失败，请稍后重试")

    return {"message": "验证码已发送"}


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest, session: AsyncSession = Depends(get_session)):
    if len(req.password) < 6 or not re.search(r'[A-Za-z]', req.password) or not re.search(r'\d', req.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="密码至少6位，必须包含字母和数字",
        )

    # Verify email code
    if not verification_store.verify_code("register", req.email, req.code):
        raise HTTPException(status_code=400, detail="验证码无效或已过期")

    # Look up pre-created user
    result = await session.execute(select(User).where(User.username == req.username))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="用户不存在，请联系管理员创建账号")

    if user.is_registered:
        raise HTTPException(status_code=400, detail="该账号已注册")

    # Check email not taken by another user
    existing_email = await session.execute(
        select(User).where(User.email == req.email, User.id != user.id)
    )
    if existing_email.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该邮箱已被其他用户注册")

    user.email = req.email
    user.password_hash = hash_password(req.password)
    user.is_registered = True
    await session.commit()

    token = create_access_token(data={"sub": user.username, "role": user.role})
    return TokenResponse(access_token=token)


@router.post("/auth/reset-password")
async def reset_password(req: ResetPasswordRequest, session: AsyncSession = Depends(get_session)):
    if len(req.new_password) < 6 or not re.search(r'[A-Za-z]', req.new_password) or not re.search(r'\d', req.new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="密码至少6位，必须包含字母和数字",
        )

    if not verification_store.verify_code("reset_password", req.email, req.code):
        raise HTTPException(status_code=400, detail="验证码无效或已过期")

    result = await session.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    user.password_hash = hash_password(req.new_password)
    await session.commit()

    return {"message": "密码重置成功"}


@router.get("/auth/profile", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/auth/change-email", response_model=UserResponse)
async def change_email(
    req: ChangeEmailRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not verification_store.verify_code("change_email", req.new_email, req.code):
        raise HTTPException(status_code=400, detail="验证码无效或已过期")

    existing = await session.execute(select(User).where(User.email == req.new_email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该邮箱已被其他用户使用")

    user = await session.get(User, current_user.id)
    user.email = req.new_email
    await session.commit()
    await session.refresh(user)
    return user
