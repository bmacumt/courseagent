"""Auth routes: login, register, and current user."""
import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.auth.jwt import create_access_token, verify_password, hash_password
from app.db.engine import get_session
from app.db.models import User
from app.api.schemas import LoginRequest, RegisterRequest, TokenResponse, UserResponse

router = APIRouter(tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(User).where(User.username == req.username))
    user = result.scalar_one_or_none()
    if not user or not user.is_registered or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(data={"sub": user.username, "role": user.role})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest, session: AsyncSession = Depends(get_session)):
    if len(req.password) < 6 or not re.search(r'[A-Za-z]', req.password) or not re.search(r'\d', req.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="密码至少6位，必须包含字母和数字",
        )

    result = await session.execute(select(User).where(User.username == req.username))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="请联系管理员，请确认学号信息",
        )

    if user.is_registered:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该账号已注册",
        )

    user.password_hash = hash_password(req.password)
    user.is_registered = True
    await session.commit()

    token = create_access_token(data={"sub": user.username, "role": user.role})
    return TokenResponse(access_token=token)
