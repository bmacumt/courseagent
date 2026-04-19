"""Static registry of supported model providers and their model catalogs.

Each provider defines: display name, default base URL, supported model types,
and a list of recommended models. The frontend uses this to populate the
"Add Provider" UI and model selection dropdowns.
"""

PROVIDERS: dict[str, dict] = {
    "deepseek": {
        "name": "DeepSeek",
        "default_base_url": "https://api.deepseek.com",
        "supported_types": ["chat"],
        "models": [
            {"name": "deepseek-chat", "type": "chat", "max_tokens": 65536},
            {"name": "deepseek-reasoner", "type": "chat", "max_tokens": 65536},
        ],
    },
    "siliconflow": {
        "name": "SiliconFlow",
        "default_base_url": "https://api.siliconflow.cn/v1",
        "supported_types": ["chat", "embedding", "rerank"],
        "models": [
            {"name": "deepseek-ai/DeepSeek-V3", "type": "chat", "max_tokens": 8192},
            {"name": "Qwen/Qwen3-8B", "type": "chat", "max_tokens": 8192},
            {"name": "BAAI/bge-large-zh-v1.5", "type": "embedding", "max_tokens": 512},
            {"name": "BAAI/bge-large-en-v1.5", "type": "embedding", "max_tokens": 512},
            {"name": "BAAI/bge-reranker-v2-m3", "type": "rerank", "max_tokens": 512},
        ],
    },
    "openai": {
        "name": "OpenAI",
        "default_base_url": "https://api.openai.com/v1",
        "supported_types": ["chat", "embedding"],
        "models": [
            {"name": "gpt-4o", "type": "chat", "max_tokens": 16384},
            {"name": "gpt-4o-mini", "type": "chat", "max_tokens": 16384},
            {"name": "gpt-4.1", "type": "chat", "max_tokens": 1047576},
            {"name": "text-embedding-3-small", "type": "embedding", "max_tokens": 8191},
            {"name": "text-embedding-3-large", "type": "embedding", "max_tokens": 8191},
        ],
    },
    "tongyi": {
        "name": "通义千问",
        "default_base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "supported_types": ["chat", "embedding"],
        "models": [
            {"name": "qwen-turbo", "type": "chat", "max_tokens": 131072},
            {"name": "qwen-plus", "type": "chat", "max_tokens": 131072},
            {"name": "qwen-max", "type": "chat", "max_tokens": 32768},
            {"name": "text-embedding-v3", "type": "embedding", "max_tokens": 8192},
        ],
    },
    "zhipu": {
        "name": "智谱AI",
        "default_base_url": "https://open.bigmodel.cn/api/paas/v4",
        "supported_types": ["chat", "embedding"],
        "models": [
            {"name": "glm-4-plus", "type": "chat", "max_tokens": 128000},
            {"name": "glm-4-flash", "type": "chat", "max_tokens": 128000},
            {"name": "embedding-3", "type": "embedding", "max_tokens": 512},
        ],
    },
    "moonshot": {
        "name": "Moonshot",
        "default_base_url": "https://api.moonshot.cn/v1",
        "supported_types": ["chat"],
        "models": [
            {"name": "moonshot-v1-8k", "type": "chat", "max_tokens": 8192},
            {"name": "moonshot-v1-32k", "type": "chat", "max_tokens": 32768},
            {"name": "moonshot-v1-128k", "type": "chat", "max_tokens": 131072},
        ],
    },
}


def get_provider_types() -> list[dict]:
    """Return all available provider types for the frontend."""
    return [
        {
            "provider_type": key,
            "name": val["name"],
            "default_base_url": val["default_base_url"],
            "supported_types": val["supported_types"],
            "models": val["models"],
        }
        for key, val in PROVIDERS.items()
    ]


def get_provider_info(provider_type: str) -> dict | None:
    """Return info for a specific provider type."""
    return PROVIDERS.get(provider_type)
