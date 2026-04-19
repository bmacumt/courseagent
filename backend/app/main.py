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
