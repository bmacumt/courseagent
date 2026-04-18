"""Settings service: seed defaults from .env, sync DB changes to os.environ."""
import logging
import os

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Setting

logger = logging.getLogger(__name__)

# Mapping: DB setting key → os.environ key
SETTING_TO_ENV = {
    "llm_api_key": "LLM_API_KEY",
    "llm_base_url": "LLM_BASE_URL",
    "llm_model": "LLM_MODEL",
    "llm_temperature": "LLM_TEMPERATURE",
    "llm_max_tokens": "LLM_MAX_TOKENS",
    "embedding_api_key": "EMBEDDING_API_KEY",
    "embedding_base_url": "EMBEDDING_BASE_URL",
    "embedding_model": "EMBEDDING_MODEL",
    "embedding_dimension": "EMBEDDING_DIMENSION",
    "embedding_batch_size": "EMBEDDING_BATCH_SIZE",
    "reranker_api_key": "RERANKER_API_KEY",
    "reranker_base_url": "RERANKER_BASE_URL",
    "reranker_model": "RERANKER_MODEL",
    "reranker_top_k": "RERANKER_TOP_K",
    "mineru_api_token": "MINERU_API_TOKEN",
    "mineru_base_url": "MINERU_BASE_URL",
    "mineru_chunk_size": "MINERU_CHUNK_SIZE",
    "mineru_chunk_overlap": "MINERU_CHUNK_OVERLAP",
    "access_token_expire_minutes": "ACCESS_TOKEN_EXPIRE_MINUTES",
    "max_file_size_mb": "MAX_FILE_SIZE_MB",
    "rag_retrieval_top_k": "RAG_RETRIEVAL_TOP_K",
}

# Default values: (category, key, env_var_or_default)
DEFAULTS = [
    ("llm", "llm_api_key", "LLM_API_KEY"),
    ("llm", "llm_base_url", "LLM_BASE_URL"),
    ("llm", "llm_model", "LLM_MODEL"),
    ("llm", "llm_temperature", "0.1"),
    ("llm", "llm_max_tokens", "2048"),
    ("embedding", "embedding_api_key", "EMBEDDING_API_KEY"),
    ("embedding", "embedding_base_url", "EMBEDDING_BASE_URL"),
    ("embedding", "embedding_model", "EMBEDDING_MODEL"),
    ("embedding", "embedding_dimension", "1024"),
    ("embedding", "embedding_batch_size", "32"),
    ("reranker", "reranker_api_key", "RERANKER_API_KEY"),
    ("reranker", "reranker_base_url", "RERANKER_BASE_URL"),
    ("reranker", "reranker_model", "RERANKER_MODEL"),
    ("reranker", "reranker_top_k", "5"),
    ("mineru", "mineru_api_token", "MINERU_API_TOKEN"),
    ("mineru", "mineru_base_url", "MINERU_BASE_URL"),
    ("mineru", "mineru_chunk_size", "512"),
    ("mineru", "mineru_chunk_overlap", "64"),
    ("general", "access_token_expire_minutes", "ACCESS_TOKEN_EXPIRE_MINUTES"),
    ("general", "max_file_size_mb", "50"),
    ("general", "rag_retrieval_top_k", "20"),
]


async def seed_defaults(session: AsyncSession) -> None:
    """Insert default settings from env vars if they don't exist in DB."""
    result = await session.execute(select(Setting))
    existing = {s.key for s in result.scalars().all()}

    added = 0
    for category, key, value_or_env in DEFAULTS:
        if key not in existing:
            # If value_or_env is an env var name, read from env; otherwise use as literal
            value = os.getenv(value_or_env, value_or_env)
            setting = Setting(key=key, value=value, category=category)
            session.add(setting)
            added += 1

    if added:
        await session.commit()
        logger.info(f"Seeded {added} default settings")


def sync_to_env(key: str, value: str) -> None:
    """Sync a DB setting value to os.environ so services pick it up."""
    env_key = SETTING_TO_ENV.get(key)
    if env_key:
        os.environ[env_key] = value
        logger.info(f"Synced setting {key} → {env_key}")
