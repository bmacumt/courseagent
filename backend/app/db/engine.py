"""Async SQLAlchemy engine and session factory."""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.config import DATABASE_PATH

DATABASE_URL = f"sqlite+aiosqlite:///{DATABASE_PATH}"

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    from app.db.models import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Migration: add grade column if not exists (for existing databases)
        result = await conn.execute(
            __import__('sqlalchemy').text("PRAGMA table_info(users)")
        )
        columns = [row[1] for row in result.fetchall()]
        if 'grade' not in columns:
            await conn.execute(
                __import__('sqlalchemy').text(
                    "ALTER TABLE users ADD COLUMN grade VARCHAR(20)"
                )
            )
        # Migration: add target_grade/target_classes to assignments
        a_result = await conn.execute(
            __import__('sqlalchemy').text("PRAGMA table_info(assignments)")
        )
        a_columns = [row[1] for row in a_result.fetchall()]
        if 'target_grade' not in a_columns:
            await conn.execute(
                __import__('sqlalchemy').text(
                    "ALTER TABLE assignments ADD COLUMN target_grade VARCHAR(20)"
                )
            )
        if 'target_classes' not in a_columns:
            await conn.execute(
                __import__('sqlalchemy').text(
                    "ALTER TABLE assignments ADD COLUMN target_classes TEXT"
                )
            )


async def get_session():
    async with async_session() as session:
        yield session
