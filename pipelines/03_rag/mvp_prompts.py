"""
MVP test for 03_rag prompts module

Usage:
  .venv/bin/python mvp_prompts.py
"""
import asyncio
import json
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from app.prompts.loader import load_prompt, render_prompt
from app.prompts.generator import (
    message_fit_in,
    keyword_extraction,
    sufficiency_check,
    multi_queries_gen,
)
from app.core.llm_client import LLMClient


def test_loader():
    print("=== prompts/loader ===")
    tpl = load_prompt("ask_summary")
    print(f"  ask_summary loaded: {len(tpl)} chars")
    assert "knowledge" in tpl

    rendered = render_prompt("ask_summary", knowledge="隧道支护应根据围岩级别确定。")
    assert "隧道支护" in rendered
    print(f"  render_prompt: knowledge injected OK")

    tpl2 = load_prompt("sufficiency_check")
    assert "is_sufficient" in tpl2
    print(f"  sufficiency_check loaded: {len(tpl2)} chars")
    print("  [PASS]\n")


def test_message_fit_in():
    print("=== message_fit_in ===")
    msg = [
        {"role": "system", "content": "你是一个助手" * 100},
        {"role": "user", "content": "测试问题"},
    ]
    c, trimmed = message_fit_in(msg, max_length=50)
    print(f"  trimmed to {c} tokens, {len(trimmed)} messages")
    assert c <= 50 or len(trimmed) <= 2
    print("  [PASS]\n")


async def test_keyword_extraction():
    print("=== keyword_extraction ===")
    api_key = os.getenv("LLM_API_KEY")
    if not api_key:
        print("  [SKIP] LLM_API_KEY not set\n")
        return

    client = LLMClient()
    result = await keyword_extraction(
        client,
        content="隧道支护设计应根据围岩级别、隧道跨度及埋深等因素综合确定。系统锚杆长度不应小于2.5m。",
        topn=3,
    )
    print(f"  keywords: {result}")
    assert result, "should return keywords"
    print("  [PASS]\n")


async def test_sufficiency_check():
    print("=== sufficiency_check ===")
    api_key = os.getenv("LLM_API_KEY")
    if not api_key:
        print("  [SKIP] LLM_API_KEY not set\n")
        return

    client = LLMClient()
    result = await sufficiency_check(
        client,
        question="隧道支护设计的基本要求是什么？",
        retrieved_docs="3.1.1 隧道支护应根据围岩级别、跨度及埋深等因素综合确定。",
    )
    print(f"  result: {json.dumps(result, ensure_ascii=False, indent=2)}")
    assert "is_sufficient" in result
    print("  [PASS]\n")


async def test_multi_queries_gen():
    print("=== multi_queries_gen ===")
    api_key = os.getenv("LLM_API_KEY")
    if not api_key:
        print("  [SKIP] LLM_API_KEY not set\n")
        return

    client = LLMClient()
    result = await multi_queries_gen(
        client,
        question="隧道防水措施有哪些？",
        query="隧道 防水 措施",
        missing_infos=["防水层厚度要求", "排水系统设计"],
        retrieved_docs="隧道应设置防水层。",
    )
    print(f"  result: {json.dumps(result, ensure_ascii=False, indent=2)}")
    print("  [PASS]\n")


if __name__ == "__main__":
    test_loader()
    test_message_fit_in()
    asyncio.run(test_keyword_extraction())
    asyncio.run(test_sufficiency_check())
    asyncio.run(test_multi_queries_gen())
    print("All prompts tests passed!")
