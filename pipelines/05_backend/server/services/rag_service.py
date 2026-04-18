"""RAG service: wraps 03_rag PipelineManager with business context."""
import logging
import os
import sys

from server.config import RAG_PATH, CHROMA_PATH
from server.db.models import Document

# Import 03_rag components (no namespace collision — our package is 'server/', not 'app/')
if RAG_PATH not in sys.path:
    sys.path.insert(0, RAG_PATH)
from app.manager import PipelineManager

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
        result = self.manager.ingest_pdf(pdf_path)
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

    async def query(self, question: str) -> dict:
        """RAG query: global search across all documents."""
        return await self.manager.query(question)
