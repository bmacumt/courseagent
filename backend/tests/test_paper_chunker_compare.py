"""论文 RAG 分块策略对比测试。

用法:
    cd courseagent/backend
    .venv/bin/python tests/test_paper_chunker_compare.py

流程:
    1. MinerU 解析 PDF → content_list（只解析一次，缓存到本地）
    2. 5 种 doc_type 分别分块 → 输出分块统计
    3. 每种 doc_type 独立入库（不同 collection）→ 问 5 个问题
    4. 结果写入 tests/结果对比.md
"""
import asyncio
import json
import os
import sys
import time
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from dotenv import load_dotenv

load_dotenv()

# ── 配置 ──────────────────────────────────────────────

PDF_PATH = os.path.join(
    os.path.dirname(__file__), "..", "data",
    "Domain adaptation for structural health monitoring.pdf",
)
CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "output", "shm_paper")
RESULT_FILE = os.path.join(os.path.dirname(__file__), "结果对比.md")

DOC_TYPES = ["laws", "book", "table", "paper", "ppt"]

QUESTIONS = [
    "What method is proposed in this paper to address domain shift in structural health monitoring?",
    "What are the source domain and target domain defined in this paper for SHM?",
    "Write the approximate formula for H-divergence mentioned in the paper.",
    "In the three-story structure case study, what is the target domain accuracy after using DANN?",
    "Why does DANN outperform TCA in domain adaptation for structural health monitoring?",
]


def log(msg):
    print(msg, flush=True)


# ── Step 1: MinerU 解析（只做一次）────────────────────

def parse_pdf_once():
    content_list_path = os.path.join(CACHE_DIR, "content_list.json")
    if os.path.exists(content_list_path):
        log("  [缓存命中] 读取已解析的 content_list.json")
        with open(content_list_path, "r", encoding="utf-8") as f:
            return json.load(f)

    log("  [MinerU] 上传并解析 PDF（约 1-3 分钟）...")
    from app.services.rag.mineru_client import MinerUClient
    client = MinerUClient()
    t0 = time.time()
    content_list = client.parse_pdf(PDF_PATH, output_dir=CACHE_DIR)
    elapsed = time.time() - t0
    log(f"  [MinerU] 完成: {len(content_list)} blocks, {elapsed:.1f}s")

    # 缓存
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(content_list_path, "w", encoding="utf-8") as f:
        json.dump(content_list, f, ensure_ascii=False, indent=2)
    log(f"  [缓存] 已保存到 {content_list_path}")

    return content_list


# ── Step 2: 各 doc_type 分块 ──────────────────────────

def chunk_with_types(content_list):
    from app.services.rag.chunking.mineru_adapter import mineru_to_sections
    from app.services.rag.chunking.dispatcher import dispatch_chunk
    from app.services.rag.token_utils import num_tokens_from_string

    sections = mineru_to_sections(content_list)
    log(f"  [Adapter] {len(sections)} sections, types: "
        f"{dict(__import__('collections').Counter(layout for _, layout in sections))}")

    results = {}
    for dtype in DOC_TYPES:
        chunks = dispatch_chunk(sections, doc_type=dtype)
        chunks = [c for c in chunks if c.strip()]
        token_counts = [num_tokens_from_string(c) for c in chunks]
        avg_tokens = sum(token_counts) / len(token_counts) if token_counts else 0
        max_tokens = max(token_counts) if token_counts else 0
        min_tokens = min(token_counts) if token_counts else 0
        results[dtype] = {
            "chunks": chunks,
            "num_chunks": len(chunks),
            "avg_tokens": avg_tokens,
            "max_tokens": max_tokens,
            "min_tokens": min_tokens,
        }
        log(f"  [{dtype:6}] {len(chunks):3d} chunks | avg={avg_tokens:6.0f} "
            f"min={min_tokens:4d} max={max_tokens:5d} tokens")

    return results


# ── Step 3: 单个 doc_type 完整 QA 测试 ────────────────

async def test_one_doc_type(dtype, chunk_texts, questions):
    """为一个 doc_type 创建独立 pipeline 并问答。"""
    from app.services.rag.embedder import Embedder
    from app.services.rag.vector_store import VectorStore
    from app.services.rag.retriever import HybridRetriever
    from app.services.rag.reranker import Reranker
    from app.services.rag.qa_chain import QAChain
    from app.services.rag.llm_client import LLMClient

    # 使用临时目录的 ChromaDB，避免互相干扰
    tmp_dir = tempfile.mkdtemp(prefix=f"rag_test_{dtype}_")
    doc_id = f"test_{dtype}"

    embedder = Embedder()
    vs = VectorStore(chroma_path=tmp_dir, collection_name=f"test_{dtype}")

    # Embed + Store
    log(f"    [{dtype}] Embedding {len(chunk_texts)} chunks...")
    embeddings = embedder.embed_texts(chunk_texts)
    metadata = [{"doc_id": doc_id, "chunk_index": i} for i in range(len(chunk_texts))]
    vs.add_chunks(doc_id, chunk_texts, embeddings, metadata)

    # Build retriever
    retriever = HybridRetriever(vs, embedder)
    retriever.rebuild_bm25()

    # QA Chain
    reranker = Reranker()
    llm = LLMClient()
    qa = QAChain(retriever=retriever, embedder=embedder, reranker=reranker, llm=llm)

    # Ask questions
    answers = {}
    for i, q in enumerate(questions):
        log(f"    [{dtype}] Q{i+1}: {q[:60]}...")
        t0 = time.time()
        try:
            result = await qa.answer(q)
            elapsed = time.time() - t0
            answer = result.get("answer", "NO ANSWER")
            sources = result.get("sources", [])
            answers[q] = {
                "answer": answer,
                "num_sources": len(sources),
                "elapsed": elapsed,
                "retrieved": result.get("num_retrieved", 0),
                "reranked": result.get("num_reranked", 0),
            }
            log(f"    [{dtype}] A{i+1}: {elapsed:.1f}s, {len(sources)} sources, "
                f"{len(answer)} chars")
        except Exception as e:
            answers[q] = {"answer": f"ERROR: {e}", "num_sources": 0, "elapsed": 0,
                          "retrieved": 0, "reranked": 0}
            log(f"    [{dtype}] A{i+1}: FAILED - {e}")

    # Cleanup
    import shutil
    shutil.rmtree(tmp_dir, ignore_errors=True)

    return answers


def test_all_qa(chunk_results, questions):
    """对每个 doc_type 运行 QA 测试。"""
    all_answers = {}

    for dtype in DOC_TYPES:
        log(f"\n  [{dtype}] 开始 QA 测试...")
        chunks = chunk_results[dtype]["chunks"]
        try:
            loop = asyncio.get_event_loop()
            if loop.is_closed():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        answers = loop.run_until_complete(test_one_doc_type(dtype, chunks, questions))
        all_answers[dtype] = answers

    return all_answers


# ── Step 4: 生成对比 Markdown ──────────────────────────

def write_comparison(chunk_results, all_answers, questions):
    lines = []
    lines.append("# 论文 RAG 分块策略对比测试")
    lines.append("")
    lines.append(f"**测试文档**: Domain adaptation for structural health monitoring.pdf")
    lines.append(f"**文档类型**: 英文学术论文（SHM 领域）")
    lines.append(f"**分块策略**: laws / book / table / paper / ppt")
    lines.append("")

    # 分块统计对比表
    lines.append("## 1. 分块统计对比")
    lines.append("")
    lines.append("| doc_type | chunks | avg_tokens | min_tokens | max_tokens |")
    lines.append("|----------|--------|------------|------------|------------|")
    for dtype in DOC_TYPES:
        r = chunk_results[dtype]
        lines.append(f"| {dtype:8} | {r['num_chunks']:6d} | {r['avg_tokens']:10.0f} | "
                     f"{r['min_tokens']:10d} | {r['max_tokens']:10d} |")
    lines.append("")

    # 每个问题的回答对比
    lines.append("## 2. 问答结果对比")
    lines.append("")

    for i, q in enumerate(questions):
        lines.append(f"### Q{i+1}: {q}")
        lines.append("")

        # 汇总表
        lines.append("| doc_type | sources | retrieved | reranked | time(s) | answer_length |")
        lines.append("|----------|---------|-----------|----------|---------|---------------|")
        for dtype in DOC_TYPES:
            a = all_answers[dtype].get(q, {})
            lines.append(f"| {dtype:8} | {a.get('num_sources', 0):7d} | "
                         f"{a.get('retrieved', 0):9d} | {a.get('reranked', 0):8d} | "
                         f"{a.get('elapsed', 0):7.1f} | {len(a.get('answer', '')):13d} |")
        lines.append("")

        # 每种策略的回答
        for dtype in DOC_TYPES:
            a = all_answers[dtype].get(q, {})
            answer = a.get("answer", "N/A")
            lines.append(f"**[{dtype}]**")
            lines.append(f"> {answer[:500]}")
            if len(answer) > 500:
                lines.append(f"> ...（共 {len(answer)} 字符）")
            lines.append("")

        lines.append("---")
        lines.append("")

    # 写入文件
    content = "\n".join(lines)
    os.makedirs(os.path.dirname(RESULT_FILE), exist_ok=True)
    with open(RESULT_FILE, "w", encoding="utf-8") as f:
        f.write(content)
    log(f"\n  [结果] 已写入 {RESULT_FILE}")


# ── 主流程 ────────────────────────────────────────────

def main():
    log("=" * 60)
    log("  论文 RAG 分块策略对比测试")
    log("=" * 60)

    if not os.path.exists(PDF_PATH):
        log(f"  PDF 不存在: {PDF_PATH}")
        return

    # Step 1: Parse
    log("\n[Step 1] MinerU 解析 PDF")
    content_list = parse_pdf_once()
    if not content_list:
        log("  解析失败，退出")
        return

    # 统计类型
    types = {}
    for b in content_list:
        t = b.get("type", "unknown")
        types[t] = types.get(t, 0) + 1
    log(f"  内容类型: {types}")

    # Step 2: Chunk
    log("\n[Step 2] 5 种 doc_type 分块")
    chunk_results = chunk_with_types(content_list)

    # Step 3: QA
    log("\n[Step 3] 各 doc_type QA 测试（每个问 5 个问题）")
    all_answers = test_all_qa(chunk_results, QUESTIONS)

    # Step 4: Write comparison
    log("\n[Step 4] 生成对比报告")
    write_comparison(chunk_results, all_answers, QUESTIONS)

    log("\n测试完成。")


if __name__ == "__main__":
    main()
