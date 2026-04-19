"""FastAPI main application: router aggregation and lifespan."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.engine import init_db, async_session
from app.api.auth_routes import router as auth_router
from app.api.admin import router as admin_router
from app.api.teacher import router as teacher_router
from app.api.student import router as student_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    from app.services.settings_service import seed_defaults
    from app.services.config_resolver import sync_model_defaults_to_env
    async with async_session() as session:
        await seed_defaults(session)
        await sync_model_defaults_to_env(session)

        # Seed default accounts if DB is fresh
        from sqlalchemy import select
        from app.db.models import User
        from app.auth.jwt import hash_password
        existing = await session.scalar(select(User).where(User.username == "2234152"))
        if not existing:
            defaults = [
                # 正式管理员
                User(username="2234152", password_hash=hash_password("admin123"), role="admin", real_name="张院长", student_id="2234152", is_registered=True),
                # 测试账号（交付时删除）
                User(username="admin", password_hash=hash_password("admin123"), role="admin", real_name="测试管理员", is_registered=True),
                User(username="teacher1", password_hash=hash_password("teacher123"), role="teacher", real_name="张老师", student_id="T001", is_registered=True),
                User(username="student1", password_hash=hash_password("student123"), role="student", real_name="王同学", student_id="2024001", class_name="隧道一班", is_registered=True),
            ]
            for u in defaults:
                session.add(u)
            await session.commit()
    yield


app = FastAPI(title="隧道工程课程智能体", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(teacher_router)
app.include_router(student_router)

from app.api.models import router as models_router
app.include_router(models_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
