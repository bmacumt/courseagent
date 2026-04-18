"""Hybrid retriever: Vector search + BM25 + RRF fusion."""
import logging
import math
import os
import re
from collections import defaultdict

from rank_bm25 import BM25Okapi

from app.services.rag.embedder import Embedder
from app.services.rag.vector_store import VectorStore

logger = logging.getLogger(__name__)


def _tokenize_chinese(text: str) -> list[str]:
    """Simple Chinese text tokenization: split on whitespace + single chars for CJK."""
    # Remove punctuation, split on whitespace, then split CJK into individual chars
    text = re.sub(r"[，。；：！？、\n\r\t]", " ", text)
    tokens = []
    for word in text.split():
        if any('\u4e00' <= c <= '\u9fff' for c in word):
            # CJK: keep as-is or split into bigrams
            tokens.append(word)
        else:
            tokens.extend(word.lower().split())
    return tokens


class HybridRetriever:
    def __init__(
        self,
        vector_store: VectorStore,
        embedder: Embedder,
        vector_top_k: int = 20,
        bm25_top_k: int = 20,
        rrf_k: int = 60,
    ):
        self.vs = vector_store
        self.embedder = embedder
        self.vector_top_k = vector_top_k
        self.bm25_top_k = bm25_top_k
        self.rrf_k = rrf_k
        self._bm25_corpus: list[str] = []
        self._bm25_tokenized: list[list[str]] = []
        self._bm25: BM25Okapi | None = None
        self._bm25_ids: list[str] = []

    def rebuild_bm25(self):
        """Rebuild BM25 index from all documents in ChromaDB."""
        all_data = self.vs.collection.get(include=["documents", "metadatas"])
        if not all_data or not all_data["ids"]:
            logger.warning("No data in ChromaDB, BM25 index empty")
            return

        self._bm25_corpus = all_data["documents"] or []
        self._bm25_ids = all_data["ids"]
        self._bm25_tokenized = [_tokenize_chinese(doc) for doc in self._bm25_corpus]
        self._bm25 = BM25Okapi(self._bm25_tokenized)
        logger.info(f"BM25 index rebuilt: {len(self._bm25_corpus)} docs")

    def retrieve(self, query: str, top_k: int = 15) -> list[dict]:
        """Hybrid retrieval: vector + BM25 → RRF fusion.

        Returns list of dicts: {"id", "text", "metadata", "score"}
        """
        # Vector search
        query_embedding = self.embedder.embed_query(query)
        vector_results = self.vs.search(query_embedding, top_k=self.vector_top_k)

        # BM25 search
        bm25_results = self._bm25_search(query, top_k=self.bm25_top_k)

        # RRF fusion
        fused = self._rrf_fusion(vector_results, bm25_results)

        # Return top_k
        return fused[:top_k]

    def _bm25_search(self, query: str, top_k: int = 20) -> list[dict]:
        if not self._bm25:
            return []

        tokenized_query = _tokenize_chinese(query)
        scores = self._bm25.get_scores(tokenized_query)

        scored = []
        for i, score in enumerate(scores):
            if score > 0:
                scored.append({
                    "id": self._bm25_ids[i],
                    "text": self._bm25_corpus[i],
                    "score": float(score),
                })

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top_k]

    def _rrf_fusion(self, vector_results: list[dict], bm25_results: list[dict]) -> list[dict]:
        """Reciprocal Rank Fusion of vector and BM25 results."""
        rrf_scores: dict[str, float] = defaultdict(float)
        doc_map: dict[str, dict] = {}

        for rank, doc in enumerate(vector_results):
            doc_id = doc["id"]
            rrf_scores[doc_id] += 1.0 / (self.rrf_k + rank + 1)
            doc_map[doc_id] = doc

        for rank, doc in enumerate(bm25_results):
            doc_id = doc["id"]
            rrf_scores[doc_id] += 1.0 / (self.rrf_k + rank + 1)
            if doc_id not in doc_map:
                doc_map[doc_id] = doc

        fused = []
        for doc_id, score in sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True):
            entry = dict(doc_map[doc_id])
            entry["rrf_score"] = score
            fused.append(entry)

        return fused
