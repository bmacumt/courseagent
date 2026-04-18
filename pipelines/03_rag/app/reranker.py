"""Reranker client using SiliconFlow API (Cohere-compatible rerank endpoint).

Supports: BAAI/bge-reranker-v2-m3 and similar models.
"""
import logging
import os

import requests

logger = logging.getLogger(__name__)


class Reranker:
    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
    ):
        self.api_key = api_key or os.getenv("RERANKER_API_KEY", "")
        self.base_url = (base_url or os.getenv("RERANKER_BASE_URL", "https://api.siliconflow.cn/v1")).rstrip("/")
        self.model = model or os.getenv("RERANKER_MODEL", "BAAI/bge-reranker-v2-m3")

    def rerank(
        self,
        query: str,
        documents: list[str],
        top_k: int = 5,
    ) -> list[dict]:
        """Rerank documents against a query.

        Returns list of dicts: {"index": int, "relevance_score": float, "text": str}
        sorted by relevance_score descending.
        """
        resp = requests.post(
            f"{self.base_url}/rerank",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.model,
                "query": query,
                "documents": documents,
                "top_k": min(top_k, len(documents)),
                "return_documents": True,
            },
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])

        ranked = []
        for r in results:
            ranked.append({
                "index": r["index"],
                "relevance_score": r["relevance_score"],
                "text": r.get("document", {}).get("text", documents[r["index"]]),
            })

        ranked.sort(key=lambda x: x["relevance_score"], reverse=True)
        logger.info(f"Reranked {len(documents)} docs -> top {len(ranked)}")
        return ranked
