"""
MVP test for 03_rag deep research module

Usage:
  .venv/bin/python mvp_deep_research.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from app.core.llm_client import LLMClient
from app.advanced_rag.deep_research import DeepResearch


# Simulated retriever for testing
async def mock_retriever(query: str) -> list[dict]:
    """Mock retriever that returns different results for different queries."""
    knowledge_base = {
        "支护": [
            {"chunk_id": "c1", "content": "3.1.1 隧道支护应根据围岩级别综合确定。", "doc_name": "JTG_D70"},
            {"chunk_id": "c2", "content": "3.2.1 系统锚杆长度不应小于2.5m。", "doc_name": "JTG_D70"},
        ],
        "防水": [
            {"chunk_id": "c3", "content": "5.1.1 隧道应设置防水层，厚度不小于1.5mm。", "doc_name": "JTG_D70"},
        ],
        "排水": [
            {"chunk_id": "c4", "content": "5.2.1 隧道排水系统应包括纵向排水管和环向排水管。", "doc_name": "JTG_D70"},
        ],
        "厚度": [
            {"chunk_id": "c5", "content": "5.1.2 防水层厚度应根据水压确定，最小1.5mm。", "doc_name": "JTG_D70"},
        ],
    }

    results = []
    for keyword, chunks in knowledge_base.items():
        if keyword in query:
            results.extend(chunks)

    # If no specific match, return empty (forces follow-up queries)
    return results


async def callback(msg: str):
    print(f"  >> {msg}")


async def test_deep_research():
    print("=== deep_research ===")
    api_key = os.getenv("LLM_API_KEY")
    if not api_key:
        print("  [SKIP] LLM_API_KEY not set\n")
        return

    client = LLMClient()
    researcher = DeepResearch(
        retriever=mock_retriever,
        llm_client=client,
        max_depth=2,
    )

    # A complex question that requires multiple retrievals
    question = "隧道工程中支护设计和防水排水措施的完整要求是什么？"
    print(f"  question: {question}")
    print()

    results = await researcher.research(question, callback=callback)

    print(f"\n  Final: {len(results)} chunks collected")
    for r in results:
        content = r["content"][:60]
        print(f"    [{r['chunk_id']}] {content}...")

    assert len(results) > 0, "should collect some results"
    print("  [PASS]\n")


if __name__ == "__main__":
    asyncio.run(test_deep_research())
    print("Deep research test passed!")
