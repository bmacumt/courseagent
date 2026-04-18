"""ChromaDB vector store for chunk storage and retrieval."""
import logging
import os
import uuid
from typing import Any

import chromadb

logger = logging.getLogger(__name__)


class VectorStore:
    def __init__(self, chroma_path: str | None = None, collection_name: str = "tunnel_knowledge"):
        self.chroma_path = chroma_path or os.getenv("CHROMA_PATH", "./data/chroma")
        self.client = chromadb.PersistentClient(path=self.chroma_path)
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(f"ChromaDB collection '{collection_name}': {self.collection.count()} chunks")

    def add_chunks(
        self,
        doc_id: str,
        chunks: list[str],
        embeddings: list[list[float]],
        metadata_list: list[dict] | None = None,
    ) -> int:
        """Add chunks with embeddings to ChromaDB.

        Args:
            doc_id: Document identifier
            chunks: List of chunk texts
            embeddings: List of embedding vectors
            metadata_list: Optional list of metadata dicts per chunk

        Returns:
            Number of chunks added
        """
        if not chunks:
            return 0

        ids = [f"{doc_id}_{i}" for i in range(len(chunks))]

        if metadata_list is None:
            metadata_list = [{"doc_id": doc_id, "chunk_index": i} for i in range(len(chunks))]
        else:
            for i, m in enumerate(metadata_list):
                m.setdefault("doc_id", doc_id)
                m.setdefault("chunk_index", i)

        # ChromaDB add in batches of 500
        batch_size = 500
        for i in range(0, len(chunks), batch_size):
            end = i + batch_size
            self.collection.add(
                ids=ids[i:end],
                documents=chunks[i:end],
                embeddings=embeddings[i:end],
                metadatas=metadata_list[i:end],
            )

        logger.info(f"Added {len(chunks)} chunks for doc_id={doc_id}")
        return len(chunks)

    def search(
        self,
        query_embedding: list[float],
        top_k: int = 20,
        where: dict | None = None,
    ) -> list[dict]:
        """Search by embedding vector.

        Returns list of dicts: {"id", "text", "metadata", "distance"}
        """
        kwargs = {
            "query_embeddings": [query_embedding],
            "n_results": min(top_k, self.collection.count()) if self.collection.count() > 0 else top_k,
        }
        if where:
            kwargs["where"] = where

        results = self.collection.query(**kwargs)

        chunks = []
        if results and results["ids"] and results["ids"][0]:
            for i in range(len(results["ids"][0])):
                chunks.append({
                    "id": results["ids"][0][i],
                    "text": results["documents"][0][i] if results["documents"] else "",
                    "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                    "distance": results["distances"][0][i] if results["distances"] else 0,
                })
        return chunks

    def delete_by_doc(self, doc_id: str) -> int:
        """Delete all chunks for a document."""
        try:
            self.collection.delete(where={"doc_id": doc_id})
            logger.info(f"Deleted chunks for doc_id={doc_id}")
            return 1
        except Exception as e:
            logger.error(f"Failed to delete doc_id={doc_id}: {e}")
            return 0

    def count(self) -> int:
        return self.collection.count()
