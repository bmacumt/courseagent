"""
MVP end-to-end test: PDF → MinerU parse → chunk

Usage:
  .venv/bin/python mvp_e2e_parse.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from app.parser.mineru_client import MinerUClient
from app.chunking.mineru_adapter import mineru_to_sections
from app.chunking.laws_chunker import chunk as laws_chunk
from app.chunking.naive_chunker import naive_merge
from app.chunking.detector import bullets_category
from app.core.token_utils import num_tokens_from_string


def main():
    pdf_path = os.path.join(os.path.dirname(__file__), "JTG 1001-2017 公路工程标准体系.pdf")
    if not os.path.isfile(pdf_path):
        print(f"PDF not found: {pdf_path}")
        return

    print(f"=== 端到端 PDF 解析测试 ===")
    print(f"PDF: {pdf_path}")
    print(f"大小: {os.path.getsize(pdf_path) / 1024:.1f} KB")
    print()

    # Step 1: Parse PDF via MinerU API
    print("--- Step 1: MinerU 解析 ---")
    client = MinerUClient()
    content_list = client.parse_pdf(pdf_path)
    print(f"  解析结果: {len(content_list)} 个内容块")

    # 统计块类型
    type_counts = {}
    for block in content_list:
        t = block.get("type", "unknown")
        type_counts[t] = type_counts.get(t, 0) + 1
    for t, c in sorted(type_counts.items()):
        print(f"    {t}: {c} 个")

    # 统计标题层级
    headings = [b for b in content_list if b.get("text_level") is not None]
    print(f"    标题块: {len(headings)} 个")
    for h in headings[:10]:
        print(f"      level={h['text_level']}: {h['text'][:60]}")
    if len(headings) > 10:
        print(f"      ... 还有 {len(headings) - 10} 个标题")
    print()

    # Step 2: Convert to sections
    print("--- Step 2: MinerU → sections ---")
    sections = mineru_to_sections(content_list)
    print(f"  转换结果: {len(sections)} 个 sections")

    # 检测编号模式
    text_sections = [t for t, _ in sections]
    bull = bullets_category(text_sections)
    print(f"  检测到编号模式: #{bull}" if bull >= 0 else "  未检测到编号模式")
    print()

    # Step 3: Chunk
    print("--- Step 3: 分块 ---")
    if bull >= 0:
        print("  使用 laws_chunker（结构化分块）")
        chunks = laws_chunk(sections, lang="Chinese", depth=2)
    else:
        print("  使用 naive_chunker（简单合并）")
        chunks = naive_merge(sections, chunk_token_num=500)

    print(f"  分块结果: {len(chunks)} 个 chunks")
    print()

    # Step 4: 展示结果
    print("--- Step 4: 分块结果预览 ---")
    total_tokens = 0
    for i, chunk in enumerate(chunks):
        tokens = num_tokens_from_string(chunk)
        total_tokens += tokens
        first_line = chunk.split('\n')[0][:80]
        print(f"  [{i}] {tokens} tokens | {first_line}")
        if i >= 19:
            print(f"  ... 省略剩余 {len(chunks) - 20} 个 chunks")
            break

    print()
    print(f"=== 总结 ===")
    print(f"  内容块: {len(content_list)}")
    print(f"  分块数: {len(chunks)}")
    print(f"  总 tokens: {total_tokens}")
    if chunks:
        print(f"  平均 tokens/chunk: {total_tokens // len(chunks)}")


if __name__ == "__main__":
    main()
