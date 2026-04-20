"""Embedding client using SiliconFlow API (OpenAI-compatible).

Supports: BAAI/bge-large-zh-v1.5 and similar models.
"""
import logging
import os

import tiktoken
from openai import OpenAI

logger = logging.getLogger(__name__)

BGE_INSTRUCTION = "Represent this sentence for searching relevant passages: "


class Embedder:
    def __init__(
        self,
        api_key: str = "",
        base_url: str = "",
        model: str = "",
        max_tokens: int = 0,
    ):
        self.api_key = api_key or os.getenv("EMBEDDING_API_KEY", "")
        self.base_url = base_url or os.getenv("EMBEDDING_BASE_URL", "")
        self.model = model or os.getenv("EMBEDDING_MODEL", "")
        self.max_tokens = max_tokens or int(os.getenv("EMBEDDING_MAX_TOKENS", "8192"))
        self.client = OpenAI(api_key=self.api_key, base_url=self.base_url)

    def embed_texts(self, texts: list[str], batch_size: int = 32) -> list[list[float]]:
        """Embed a list of texts in batches. Truncates texts exceeding max_tokens."""
        enc = tiktoken.get_encoding("cl100k_base")
        truncated = []
        for t in texts:
            tokens = enc.encode(t)
            if len(tokens) > self.max_tokens:
                t = enc.decode(tokens[:self.max_tokens])
            truncated.append(t)

        all_embeddings = []
        for i in range(0, len(truncated), batch_size):
            batch = truncated[i : i + batch_size]
            resp = self.client.embeddings.create(model=self.model, input=batch)
            sorted_data = sorted(resp.data, key=lambda x: x.index)
            all_embeddings.extend([d.embedding for d in sorted_data])
        logger.info(f"Embedded {len(texts)} texts with {self.model}")
        return all_embeddings

    def embed_query(self, text: str) -> list[float]:
        """Embed a single query. For BGE models, prepend instruction for better retrieval."""
        input_text = BGE_INSTRUCTION + text if "bge" in self.model.lower() else text
        resp = self.client.embeddings.create(model=self.model, input=[input_text])
        return resp.data[0].embedding

    @property
    def dim(self) -> int:
        """Get embedding dimension by embedding a test string."""
        return len(self.embed_query("test"))
