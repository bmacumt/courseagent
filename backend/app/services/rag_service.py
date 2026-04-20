"""RAG service: wraps local PipelineManager with business context."""
import logging
from typing import AsyncGenerator

from app.config import CHROMA_PATH
from app.db.models import Document
from app.services.rag.manager import PipelineManager

logger = logging.getLogger(__name__)


class RAGService:
    def __init__(self):
        self.manager = PipelineManager(chroma_path=CHROMA_PATH)

    def ingest_and_register(
        self,
        pdf_path: str,
        filename: str,
        title: str,
        doc_type: str,
        owner_id: int,
        session,
    ) -> Document:
        """Ingest PDF via PipelineManager, return Document ORM object (not yet committed)."""
        result = self.manager.ingest_pdf(pdf_path, doc_type=doc_type)
        if result.get("status") != "ok":
            raise RuntimeError(f"Ingest failed: {result.get('error', 'unknown')}")

        doc = Document(
            doc_uuid=result["doc_id"],
            filename=filename,
            title=title,
            doc_type=doc_type,
            owner_id=owner_id,
            chunk_count=result["num_chunks"],
            file_path=pdf_path,
        )
        session.add(doc)
        return doc

    def delete_document(self, doc_uuid: str) -> bool:
        """Delete from ChromaDB."""
        return self.manager.delete_document(doc_uuid)

    async def query(self, question: str, deep_research: bool = False, history: list[dict] | None = None, system_prompt: str | None = None) -> dict:
        """RAG query: global search across all documents."""
        return await self.manager.query(question, deep_research=deep_research, history=history, system_prompt=system_prompt)

    async def stream_query(self, question: str, deep_research: bool = False, history: list[dict] | None = None, system_prompt: str | None = None) -> AsyncGenerator[str, None]:
        """RAG streaming query."""
        async for event in self.manager.stream_query(question, deep_research=deep_research, history=history, system_prompt=system_prompt):
            yield event
