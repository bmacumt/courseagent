"""End-to-end RAG pipeline test: PDF parse → chunk → embed → store → retrieve → rerank → answer."""
import asyncio
import json
import os
import sys
import tempfile
import time

from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.dirname(__file__))

from app.embedder import Embedder
from app.reranker import Reranker
from app.vector_store import VectorStore
from app.retriever import HybridRetriever
from app.core.llm_client import LLMClient
from app.parser.mineru_client import MinerUClient
from app.chunking.mineru_adapter import mineru_to_sections
from app.chunking.laws_chunker import chunk

# --- Test each module individually, then run full pipeline ---


def test_embedder():
    print("\n=== Test Embedder ===")
    embedder = Embedder()
    print(f"Model: {embedder.model}")

    # Test single query
    q_emb = embedder.embed_query("隧道工程的基本概念")
    print(f"Query embedding dim: {len(q_emb)}")

    # Test batch
    texts = ["隧道施工方法", "新奥法原理", "盾构法施工技术"]
    batch_emb = embedder.embed_texts(texts)
    print(f"Batch embedding: {len(batch_emb)} vectors, dim={len(batch_emb[0])}")

    print("Embedder OK ✅")
    return embedder


def test_vector_store(embedder: Embedder):
    print("\n=== Test VectorStore ===")
    with tempfile.TemporaryDirectory() as tmpdir:
        vs = VectorStore(chroma_path=tmpdir, collection_name="test_collection")
        print(f"Initial count: {vs.count()}")

        # Add test chunks
        chunks = ["隧道是埋置于地层中的工程建筑物", "新奥法是应用岩体力学的理论", "盾构法适用于软土地层"]
        embeddings = embedder.embed_texts(chunks)
        metadata = [{"doc_id": "test_doc", "chunk_index": i} for i in range(3)]
        added = vs.add_chunks("test_doc", chunks, embeddings, metadata)
        print(f"Added {added} chunks, count: {vs.count()}")

        # Search
        query_emb = embedder.embed_query("什么是新奥法")
        results = vs.search(query_emb, top_k=3)
        print(f"Search results: {len(results)}")
        for r in results:
            print(f"  - [{r['id']}] dist={r['distance']:.4f}: {r['text'][:30]}...")

        # Delete
        vs.delete_by_doc("test_doc")
        print(f"After delete, count: {vs.count()}")

    print("VectorStore OK ✅")
    return vs


def test_reranker():
    print("\n=== Test Reranker ===")
    reranker = Reranker()
    print(f"Model: {reranker.model}")

    query = "隧道施工方法有哪些"
    docs = [
        "隧道施工主要采用钻爆法、盾构法和掘进机法",
        "混凝土的配合比设计需要考虑强度要求",
        "新奥法是一种基于围岩与支护共同作用的施工方法",
        "桥梁设计荷载包括恒载和活载",
    ]
    results = reranker.rerank(query, docs, top_k=3)
    for r in results:
        print(f"  score={r['relevance_score']:.4f}: {r['text'][:40]}...")

    print("Reranker OK ✅")
    return reranker


def test_retriever(embedder: Embedder):
    print("\n=== Test HybridRetriever ===")
    with tempfile.TemporaryDirectory() as tmpdir:
        vs = VectorStore(chroma_path=tmpdir, collection_name="test_retriever")
        # Add some chunks
        chunks = [
            "隧道是埋置于地层中的工程建筑物，是人类利用地下空间的重要形式",
            "新奥法是应用岩体力学的理论，以维护和利用围岩的自承能力为基础的施工方法",
            "盾构法是使用盾构机在地下掘进的一种隧道施工方法，适用于软土地层",
            "钻爆法是传统的隧道施工方法，通过钻孔、装药、爆破来开挖岩体",
            "TBM全断面隧道掘进机是一种集开挖、出碴、支护于一体的隧道施工机械",
        ]
        embeddings = embedder.embed_texts(chunks)
        metadata = [{"doc_id": "tunnel_intro", "chunk_index": i} for i in range(5)]
        vs.add_chunks("tunnel_intro", chunks, embeddings, metadata)

        retriever = HybridRetriever(vs, embedder, vector_top_k=5, bm25_top_k=5)
        retriever.rebuild_bm25()

        results = retriever.retrieve("隧道施工方法有哪些", top_k=3)
        print(f"Retrieved {len(results)} results:")
        for r in results:
            print(f"  rrf={r.get('rrf_score', 0):.6f}: {r['text'][:40]}...")

    print("Retriever OK ✅")


async def test_full_pipeline():
    """Full pipeline: parse PDF → chunk → embed → store → query → answer."""
    print("\n" + "=" * 60)
    print("=== Full RAG Pipeline Test ===")
    print("=" * 60)

    pdf_path = os.path.join(os.path.dirname(__file__), "JTG 1001-2017 公路工程标准体系.pdf")
    if not os.path.exists(pdf_path):
        print(f"PDF not found: {pdf_path}, skipping full pipeline test")
        return

    # 1. Parse PDF
    print("\n[1/6] Parsing PDF with MinerU...")
    mineru = MinerUClient()
    content_list = mineru.parse_pdf(pdf_path)
    print(f"  Got {len(content_list)} blocks from MinerU")

    # 2. Convert to sections and chunk
    print("\n[2/6] Chunking...")
    sections = mineru_to_sections(content_list)
    print(f"  Sections: {len(sections)}")
    chunks_result = chunk(sections, lang="zh")
    chunk_texts = [c for c in chunks_result if c.strip()]
    print(f"  Chunks: {len(chunk_texts)}")

    # Limit to first 50 chunks for testing
    chunk_texts = chunk_texts[:50]

    # 3. Embed chunks
    print("\n[3/6] Embedding chunks...")
    embedder = Embedder()
    embeddings = embedder.embed_texts(chunk_texts)
    print(f"  Embedded {len(embeddings)} chunks, dim={len(embeddings[0])}")

    # 4. Store in ChromaDB
    print("\n[4/6] Storing in ChromaDB...")
    with tempfile.TemporaryDirectory() as tmpdir:
        vs = VectorStore(chroma_path=tmpdir, collection_name="tunnel_test")
        metadata = [{"doc_id": "jtg_1001", "chunk_index": i} for i in range(len(chunk_texts))]
        vs.add_chunks("jtg_1001", chunk_texts, embeddings, metadata)
        print(f"  Stored {vs.count()} chunks")

        # 5. Retrieve
        print("\n[5/6] Retrieving...")
        retriever = HybridRetriever(vs, embedder, vector_top_k=20, bm25_top_k=20)
        retriever.rebuild_bm25()

        query = "公路工程标准体系的总体结构是什么"
        results = retriever.retrieve(query, top_k=10)
        print(f"  Retrieved {len(results)} results for: '{query}'")

        # 6. Rerank + Generate answer
        print("\n[6/6] Reranking + Generating answer...")
        reranker = Reranker()
        doc_texts = [r["text"] for r in results]
        reranked = reranker.rerank(query, doc_texts, top_k=5)
        print(f"  Reranked to top {len(reranked)}")

        # Build context
        context = "\n\n".join([f"[{i+1}] {r['text']}" for i, r in enumerate(reranked)])

        # LLM answer
        llm = LLMClient()
        system_msg = "你是隧道工程课程助教。根据提供的参考资料回答问题。如果资料不足以回答，请说明。"
        user_msg = f"参考资料：\n{context}\n\n问题：{query}\n\n请根据以上资料回答问题，并标注引用来源。"
        answer = await llm.async_chat(system_msg, [{"role": "user", "content": user_msg}])
        print(f"\n--- Answer ---\n{answer}\n--- End ---")

    print("\n✅ Full pipeline test completed!")


async def main():
    # Individual module tests
    embedder = test_embedder()
    test_vector_store(embedder)
    test_reranker()
    test_retriever(embedder)

    # Full pipeline
    await test_full_pipeline()


if __name__ == "__main__":
    asyncio.run(main())
