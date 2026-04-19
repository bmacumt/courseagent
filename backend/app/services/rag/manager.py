"""Pipeline manager: orchestrate PDF ingest and QA query."""
import logging
import os
import uuid
from typing import AsyncGenerator

from app.services.rag.chunking.dispatcher import dispatch_chunk
from app.services.rag.chunking.mineru_adapter import mineru_to_sections
from app.services.rag.llm_client import LLMClient
from app.services.rag.embedder import Embedder
from app.services.rag.mineru_client import MinerUClient
from app.services.rag.qa_chain import QAChain
from app.services.rag.deep_research_chain import DeepResearchChain
from app.services.rag.reranker import Reranker
from app.services.rag.retriever import HybridRetriever
from app.services.rag.vector_store import VectorStore

logger = logging.getLogger(__name__)


class PipelineManager:
    def __init__(self, chroma_path: str | None = None):
        self.embedder = Embedder()
        self.vector_store = VectorStore(chroma_path=chroma_path)
        self.reranker = Reranker()
        self.llm = LLMClient()
        self.retriever = HybridRetriever(self.vector_store, self.embedder)
        self.qa_chain = QAChain(
            retriever=self.retriever,
            embedder=self.embedder,
            reranker=self.reranker,
            llm=self.llm,
        )
        self.deep_research_chain = DeepResearchChain(
            retriever=self.retriever,
            embedder=self.embedder,
            reranker=self.reranker,
            llm=self.llm,
            max_depth=2,
        )
        self.mineru = MinerUClient()

    def ingest_pdf(self, pdf_path: str, doc_id: str | None = None, doc_type: str = "book") -> dict:
        """Full ingest pipeline: PDF → parse → chunk → embed → store.

        Args:
            pdf_path: Path to PDF file
            doc_id: Optional document ID
            doc_type: Document type for chunker selection ("laws", "book", "table", "paper", "ppt")

        Returns:
            {"doc_id": str, "num_chunks": int, "status": "ok"|"error"}
        """
        doc_id = doc_id or uuid.uuid4().hex[:12]
        try:
            # 1. Parse
            logger.info(f"[ingest] Parsing {pdf_path}")
            content_list = self.mineru.parse_pdf(pdf_path)
            logger.info(f"[ingest] Got {len(content_list)} blocks")

            # 2. Chunk
            sections = mineru_to_sections(content_list)
            chunks_result = dispatch_chunk(sections, doc_type=doc_type, lang="zh")
            chunk_texts = [c for c in chunks_result if c.strip()]
            logger.info(f"[ingest] {len(chunk_texts)} chunks")

            if not chunk_texts:
                return {"doc_id": doc_id, "num_chunks": 0, "status": "error", "error": "No chunks produced"}

            # 3. Embed
            embeddings = self.embedder.embed_texts(chunk_texts)

            # 4. Store
            metadata = [{"doc_id": doc_id, "chunk_index": i, "source": os.path.basename(pdf_path)} for i in range(len(chunk_texts))]
            self.vector_store.add_chunks(doc_id, chunk_texts, embeddings, metadata)

            # 5. Rebuild BM25
            self.retriever.rebuild_bm25()

            logger.info(f"[ingest] Done: {doc_id}, {len(chunk_texts)} chunks")
            return {"doc_id": doc_id, "num_chunks": len(chunk_texts), "status": "ok"}

        except Exception as e:
            logger.error(f"[ingest] Failed: {e}")
            return {"doc_id": doc_id, "num_chunks": 0, "status": "error", "error": str(e)}

    async def query(self, question: str, deep_research: bool = False, history: list[dict] | None = None) -> dict:
        """Query pipeline: retrieve → rerank → answer."""
        logger.info(f"[query] {question[:80]} (deep_research={deep_research})")
        if deep_research:
            return await self.deep_research_chain.answer(question, history=history)
        return await self.qa_chain.answer(question, history=history)

    async def stream_query(self, question: str, deep_research: bool = False, history: list[dict] | None = None) -> AsyncGenerator[str, None]:
        """Stream query pipeline: retrieve → rerank → stream answer."""
        logger.info(f"[stream_query] {question[:80]} (deep_research={deep_research})")
        if deep_research:
            async for event in self.deep_research_chain.stream_answer(question, history=history):
                yield event
        else:
            async for event in self.qa_chain.stream_answer(question, history=history):
                yield event

    def delete_document(self, doc_id: str) -> bool:
        """Delete a document and all its chunks."""
        result = self.vector_store.delete_by_doc(doc_id)
        if result:
            self.retriever.rebuild_bm25()
        return result > 0

    def list_stats(self) -> dict:
        """Get pipeline stats."""
        return {
            "total_chunks": self.vector_store.count(),
        }
