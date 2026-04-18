"""
MVP test for 03_rag core modules: token_utils and llm_client

Usage:
  .venv/bin/python mvp_core.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from app.core.token_utils import num_tokens_from_string, truncate
from app.core.llm_client import LLMClient


def test_token_utils():
    print("=== token_utils ===")
    t1 = num_tokens_from_string("隧道工程设计规范")
    print(f"  '隧道工程设计规范' -> {t1} tokens")
    assert t1 > 0, "token count should be positive"

    t2 = num_tokens_from_string("Hello World")
    print(f"  'Hello World' -> {t2} tokens")
    assert t2 == 2, f"expected 2, got {t2}"

    truncated = truncate("这是一段测试文本用于截断验证", max_tokens=3)
    print(f"  truncate(3 tokens) -> '{truncated}'")
    assert num_tokens_from_string(truncated) <= 3

    print("  [PASS] token_utils\n")


async def test_llm_client():
    print("=== llm_client ===")
    api_key = os.getenv("LLM_API_KEY")
    if not api_key:
        print("  [SKIP] LLM_API_KEY not set\n")
        return

    client = LLMClient()
    print(f"  model: {client.model}")
    print(f"  base_url: {client.base_url}")

    resp = await client.async_chat(
        system="你是一个助手，只回答OK",
        messages=[{"role": "user", "content": "测试"}],
        max_tokens=10,
    )
    print(f"  response: {resp}")
    assert resp, "response should not be empty"
    print("  [PASS] llm_client\n")


if __name__ == "__main__":
    test_token_utils()
    asyncio.run(test_llm_client())
    print("All core tests passed!")
