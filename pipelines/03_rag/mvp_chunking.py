"""
MVP test for 03_rag chunking modules + llm_client

Usage:
  .venv/bin/python mvp_chunking.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from app.chunking.patterns import BULLET_PATTERN, not_bullet
from app.chunking.detector import bullets_category, is_chinese, is_english
from app.chunking.tree_merge import Node, tree_merge, remove_contents_table, make_colon_as_title
from app.chunking.mineru_adapter import mineru_to_sections
from app.chunking.laws_chunker import chunk as laws_chunk
from app.chunking.naive_chunker import naive_merge
from app.core.token_utils import num_tokens_from_string


def test_patterns():
    print("=== patterns ===")
    assert not not_bullet("第3章 隧道支护设计")
    assert not_bullet("0")
    print("  BULLET_PATTERN[0][1] matches '第3章 隧道支护设计':", bool(__import__('re').match(BULLET_PATTERN[0][1], "第3章 隧道支护设计")))
    print("  [PASS]\n")


def test_detector():
    print("=== detector ===")
    idx = bullets_category(["第3章 隧道支护设计", "第3.2节 锚杆设计", "第3.2.1条 锚杆类型"])
    print(f"  bullets_category(chinese numbering) -> pattern #{idx}")
    assert idx >= 0, "should detect a pattern"

    idx2 = bullets_category(["1.1 概述", "1.2 设计原则", "1.2.1 基本要求"])
    print(f"  bullets_category(decimal numbering) -> pattern #{idx2}")
    assert idx2 >= 0, "should detect a pattern"

    assert is_chinese("隧道工程设计规范")
    assert not is_chinese("Hello World")
    print("  is_chinese('隧道工程设计规范') = True  OK")
    print("  [PASS]\n")


def test_node():
    print("=== Node ===")
    root = Node(level=0, depth=2, texts=[])
    lines = [
        (1, "第3章 隧道支护设计"),
        (2, "第3.2节 锚杆设计"),
        (3, "锚杆类型应根据围岩条件选择。"),
        (3, "锚杆长度不应小于2.5m。"),
        (2, "第3.3节 喷射混凝土"),
        (3, "喷射混凝土强度等级不低于C20。"),
    ]
    root.build_tree(lines)
    tree = root.get_tree()
    print(f"  Node tree produced {len(tree)} chunks:")
    for i, t in enumerate(tree):
        first_line = t.split('\n')[0][:60]
        print(f"    chunk[{i}]: {first_line}...")
    assert len(tree) > 0, "should produce chunks"
    assert "第3章" in tree[0] or "第3.2节" in tree[0], "should include hierarchy titles"
    print("  [PASS]\n")


def test_tree_merge():
    print("=== tree_merge ===")
    sections = [
        ("第3章 隧道支护设计", ""),
        ("第3.1节 一般规定", ""),
        ("隧道支护应根据围岩级别确定。", ""),
        ("第3.2节 锚杆设计", ""),
        ("锚杆类型应根据围岩条件选择。", ""),
        ("锚杆长度不应小于2.5m。", ""),
    ]
    bull = bullets_category([t for t, _ in sections])
    print(f"  detected pattern: #{bull}")
    result = tree_merge(bull, sections, depth=2)
    print(f"  tree_merge produced {len(result)} chunks:")
    for i, chunk in enumerate(result):
        first_line = chunk.split('\n')[0][:60]
        print(f"    [{i}]: {first_line}...")
    assert len(result) > 0
    print("  [PASS]\n")


def test_mineru_adapter():
    print("=== mineru_adapter ===")
    content_list = [
        {"type": "text", "text": "第3章 隧道支护设计", "text_level": 1, "page_idx": 0, "bbox": [0,0,0,0]},
        {"type": "text", "text": "隧道支护应根据围岩级别确定设计方案。", "page_idx": 0, "bbox": [0,0,0,0]},
        {"type": "table", "table_body": "<table><tr><td>围岩级别</td></tr></table>", "page_idx": 0, "bbox": [0,0,0,0]},
    ]
    sections = mineru_to_sections(content_list)
    print(f"  converted {len(content_list)} blocks -> {len(sections)} sections:")
    for text, layout in sections:
        print(f"    ({layout or 'body'}) {text[:50]}")
    assert len(sections) == 3
    assert sections[0][1] == "title"
    assert sections[1][1] == ""
    assert sections[2][1] == "table"
    print("  [PASS]\n")


def test_laws_chunker():
    print("=== laws_chunker ===")
    sections = [
        ("第3章 隧道支护设计", ""),
        ("第3.1节 一般规定", ""),
        ("3.1.1 隧道支护应根据围岩级别、跨度及埋深等因素综合确定。", ""),
        ("3.1.2 支护设计应满足施工安全和运营安全的要求。", ""),
        ("第3.2节 锚杆设计", ""),
        ("3.2.1 锚杆类型应根据围岩条件、施工方法等因素选择。", ""),
        ("3.2.2 系统锚杆长度不应小于2.5m，且不应小于隧道跨度的1/3。", ""),
    ]
    chunks = laws_chunk(sections, lang="Chinese", depth=2)
    print(f"  laws_chunk produced {len(chunks)} chunks:")
    for i, chunk in enumerate(chunks):
        first_line = chunk.split('\n')[0][:60]
        print(f"    [{i}]: {first_line}...")
    assert len(chunks) > 0
    print("  [PASS]\n")


def test_laws_chunker_mineru():
    print("=== laws_chunker + mineru_adapter ===")
    content_list = [
        {"type": "text", "text": "第3章 隧道支护设计", "text_level": 1, "page_idx": 0, "bbox": [0,0,0,0]},
        {"type": "text", "text": "3.1.1 隧道支护应根据围岩级别综合确定。", "page_idx": 0, "bbox": [0,0,0,0]},
        {"type": "text", "text": "3.1.2 支护设计应满足安全要求。", "page_idx": 0, "bbox": [0,0,0,0]},
    ]
    sections = mineru_to_sections(content_list)
    chunks = laws_chunk(sections, lang="Chinese")
    print(f"  MinerU -> adapter -> laws_chunk: {len(chunks)} chunks")
    for i, c in enumerate(chunks):
        print(f"    [{i}]: {c[:60]}...")
    assert len(chunks) > 0
    print("  [PASS]\n")


def test_naive_chunker():
    print("=== naive_chunker ===")
    sections = ["这是第一段文字。" * 30, "这是第二段文字。" * 40]
    chunks = naive_merge(sections, chunk_token_num=100)
    print(f"  naive_merge(2 sections, chunk_token_num=100) -> {len(chunks)} chunks")
    for i, c in enumerate(chunks):
        print(f"    [{i}]: {num_tokens_from_string(c)} tokens")
    assert len(chunks) > 1, "should split into multiple chunks"
    print("  [PASS]\n")


async def test_llm_client():
    print("=== llm_client ===")
    from app.core.llm_client import LLMClient
    api_key = os.getenv("LLM_API_KEY")
    if not api_key:
        print("  [SKIP] LLM_API_KEY not set\n")
        return

    client = LLMClient()
    print(f"  model: {client.model}, base_url: {client.base_url}")

    resp = await client.async_chat(
        system="你是一个助手，只回答OK",
        messages=[{"role": "user", "content": "测试"}],
        max_tokens=10,
    )
    print(f"  response: {resp}")
    assert resp, "response should not be empty"
    print("  [PASS]\n")


if __name__ == "__main__":
    test_patterns()
    test_detector()
    test_node()
    test_tree_merge()
    test_mineru_adapter()
    test_laws_chunker()
    test_laws_chunker_mineru()
    test_naive_chunker()
    asyncio.run(test_llm_client())
    print("All chunking tests passed!")
