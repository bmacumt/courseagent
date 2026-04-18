"""Bridge to 03_rag pipeline — direct import (no subprocess)."""
import logging

from app.services.rag.embedder import Embedder
from app.services.rag.reranker import Reranker
from app.services.rag.retriever import HybridRetriever
from app.services.rag.vector_store import VectorStore

logger = logging.getLogger(__name__)


class RAGBridge:
    def __init__(self, chroma_path: str | None = None):
        self.embedder = Embedder()
        self.vector_store = VectorStore(chroma_path=chroma_path)
        self.reranker = Reranker()
        self.retriever = HybridRetriever(self.vector_store, self.embedder)
        self.retriever.rebuild_bm25()
        logger.info(f"RAG bridge ready: {self.vector_store.count()} chunks")

    def retrieve_regulations(self, topic: str, top_k: int = 10) -> list[dict]:
        """Retrieve and rerank regulations relevant to a topic."""
        results = self.retriever.retrieve(topic, top_k=top_k * 2)
        if not results:
            return []

        doc_texts = [r["text"] for r in results]
        reranked = self.reranker.rerank(topic, doc_texts, top_k=top_k)

        regulations = []
        for r in reranked:
            idx = r["index"]
            regulations.append({
                "text": results[idx]["text"],
                "metadata": results[idx].get("metadata", {}),
                "relevance_score": r["relevance_score"],
            })
        return regulations
