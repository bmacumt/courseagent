"""FastAPI application with authentication endpoints."""
from fastapi import Depends, FastAPI, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import create_access_token, verify_password
from app.database import get_session, init_db
from app.deps import get_current_user, require_role
from app.models import User

app = FastAPI(title="Auth MVP")


@app.on_event("startup")
async def startup():
    await init_db()


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    username: str
    role: str

    model_config = {"from_attributes": True}


@app.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(User).where(User.username == req.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    token = create_access_token(data={"sub": user.username, "role": user.role})
    return TokenResponse(access_token=token)


@app.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@app.get("/admin-only")
async def admin_only(admin: User = Depends(require_role("admin"))):
    return {"message": "admin access granted", "username": admin.username}


@app.get("/teacher-only")
async def teacher_only(user: User = Depends(require_role("admin", "teacher"))):
    return {"message": "teacher+ access granted", "username": user.username}
