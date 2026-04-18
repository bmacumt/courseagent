"""FastAPI main application: router aggregation and lifespan."""
from contextlib import asynccontextmanager

from fastapi import FastAPI

from server.db.engine import init_db
from server.api.auth_routes import router as auth_router
from server.api.admin import router as admin_router
from server.api.teacher import router as teacher_router
from server.api.student import router as student_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="隧道工程课程智能体", version="0.1.0", lifespan=lifespan)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(teacher_router)
app.include_router(student_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
