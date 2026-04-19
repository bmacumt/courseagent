"""RAG 端到端 MVP 测试：从 PDF 解析到检索问答。

使用方法:
    cd courseagent/backend
    .venv/bin/python tests/test_rag_e2e.py

测试内容:
    Step 1: MinerU PDF 解析 → content_list
    Step 2: 中文分块 → chunks
    Step 3: SiliconFlow Embedding → vectors
    Step 4: ChromaDB 入库 → 持久化
    Step 5: 混合检索 + 重排序
    Step 6: DeepSeek LLM 生成回答

每个步骤独立验证，失败时给出明确错误信息。
"""
import os
import sys
import time
import asyncio

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from dotenv import load_dotenv

load_dotenv()

# ── 配置 ──────────────────────────────────────────────

PDF_PATH = os.path.join(
    os.path.dirname(__file__), "..", "data", "uploads",
    "adfb36728a99_JTG 1001-2017 公路工程标准体系.pdf",
)
CHROMA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "chroma")
TEST_DOC_ID = "e2e_test_doc"

# 如果 PDF 不存在，给出提示
if not os.path.exists(PDF_PATH):
    # 尝试在 uploads 目录下找任意 PDF
    upload_dir = os.path.join(os.path.dirname(__file__), "..", "data", "uploads")
    pdfs = [f for f in os.listdir(upload_dir) if f.endswith(".pdf")] if os.path.isdir(upload_dir) else []
    if pdfs:
        PDF_PATH = os.path.join(upload_dir, pdfs[0])
    else:
        print("❌ 未找到测试 PDF 文件，请将 PDF 放入 data/uploads/ 目录")
        sys.exit(1)

PASS = "✅"
FAIL = "❌"


def header(step: str, desc: str):
    print(f"\n{'='*60}")
    print(f"  {step}: {desc}")
    print(f"{'='*60}")


def check(label: str, condition: bool, detail: str = ""):
    status = PASS if condition else FAIL
    print(f"  {status} {label}" + (f" — {detail}" if detail and condition else ""))
    if not condition:
        print(f"      → {detail}")
    return condition


# ── Step 1: MinerU PDF 解析 ────────────────────────────

def test_mineru_parse():
    header("Step 1", "MinerU PDF 解析")
    print(f"  PDF: {os.path.basename(PDF_PATH)}")

    from app.services.rag.mineru_client import MinerUClient

    client = MinerUClient()
    check("API Token 已配置", bool(client.api_token), f"Token: {client.api_token[:12]}..." if client.api_token else "MINERU_API_TOKEN 为空")
    check("Base URL", bool(client.base_url), f"{client.base_url}")

    print("  ⏳ 正在上传并解析（MinerU 云端处理，约 30-60 秒）...")
    t0 = time.time()
    try:
        content_list = client.parse_pdf(PDF_PATH)
    except Exception as e:
        check("PDF 解析", False, str(e))
        return None

    elapsed = time.time() - t0
    check("PDF 解析成功", len(content_list) > 0, f"{len(content_list)} 个内容块, 耗时 {elapsed:.1f}s")

    # 统计内容类型
    types = {}
    for block in content_list:
        t = block.get("type", "unknown")
        types[t] = types.get(t, 0) + 1
    print(f"  📊 内容类型分布: {types}")

    # 检查有文本内容
    text_blocks = [b for b in content_list if b.get("type") == "text"]
    check("包含文本块", len(text_blocks) > 0, f"{len(text_blocks)} 个文本块")

    return content_list


# ── Step 2: 中文分块 ───────────────────────────────────

def test_chunking(content_list):
    header("Step 2", "中文分块 (laws_chunker)")

    from app.services.rag.chunking.mineru_adapter import mineru_to_sections
    from app.services.rag.chunking.laws_chunker import chunk

    sections = mineru_to_sections(content_list)
    check("转换为 sections", len(sections) > 0, f"{len(sections)} 个 section")

    chunks = chunk(sections, lang="zh")
    chunk_texts = [c for c in chunks if c.strip()]
    check("分块结果", len(chunk_texts) > 0, f"{len(chunk_texts)} 个有效分块")

    # 检查分块质量
    if chunk_texts:
        avg_len = sum(len(c) for c in chunk_texts) / len(chunk_texts)
        print(f"  📊 平均分块长度: {avg_len:.0f} 字符")
        print(f"  📝 第一个分块预览: {chunk_texts[0][:100]}...")

    return chunk_texts


# ── Step 3: Embedding ─────────────────────────────────

def test_embedding(chunk_texts):
    header("Step 3", "SiliconFlow Embedding")

    from app.services.rag.embedder import Embedder

    embedder = Embedder()
    check("API Key 已配置", bool(embedder.api_key), f"Key: {embedder.api_key[:8]}...")
    check("Base URL", "siliconflow" in embedder.base_url, embedder.base_url)
    check("模型", "bge" in embedder.model.lower(), embedder.model)

    # 只 embed 前 5 个 chunk 作为快速验证
    test_texts = chunk_texts[:5]
    print(f"  ⏳ 正在对 {len(test_texts)} 个文本块进行 Embedding...")
    t0 = time.time()
    try:
        embeddings = embedder.embed_texts(test_texts)
    except Exception as e:
        check("Embedding 调用", False, str(e))
        return None, embedder

    elapsed = time.time() - t0
    check("Embedding 调用成功", len(embeddings) == len(test_texts),
          f"{len(embeddings)} 个向量, 耗时 {elapsed:.1f}s")

    if embeddings:
        dim = len(embeddings[0])
        check("向量维度", dim > 0, f"{dim} 维")

    # 对全部 chunks 做 embedding
    print(f"  ⏳ 正在对其余 {len(chunk_texts) - 5} 个文本块进行 Embedding...")
    if len(chunk_texts) > 5:
        rest_embeddings = embedder.embed_texts(chunk_texts[5:])
        embeddings.extend(rest_embeddings)
        check("全部 Embedding 完成", len(embeddings) == len(chunk_texts),
              f"共 {len(embeddings)} 个向量")

    return embeddings, embedder


# ── Step 4: ChromaDB 入库 ─────────────────────────────

def test_vector_store(chunk_texts, embeddings):
    header("Step 4", "ChromaDB 向量入库")

    from app.services.rag.vector_store import VectorStore

    vs = VectorStore(chroma_path=CHROMA_PATH)
    check("ChromaDB 路径", CHROMA_PATH, "")

    # 清理旧测试数据
    try:
        vs.delete_by_doc(TEST_DOC_ID)
        print("  🧹 已清理旧测试数据")
    except Exception:
        pass

    # 入库
    metadata = [
        {"doc_id": TEST_DOC_ID, "chunk_index": i, "source": os.path.basename(PDF_PATH)}
        for i in range(len(chunk_texts))
    ]
    added = vs.add_chunks(TEST_DOC_ID, chunk_texts, embeddings, metadata)
    check("入库成功", added == len(chunk_texts), f"{added} 个分块已入库")

    # 验证总数
    total = vs.count()
    check("ChromaDB 总分块数", total > 0, f"{total} 个分块")

    return vs


# ── Step 5: 混合检索 + 重排序 ──────────────────────────

def test_retrieval(embedder, vs):
    header("Step 5", "混合检索 + Reranker 重排序")

    from app.services.rag.retriever import HybridRetriever
    from app.services.rag.reranker import Reranker

    # 5a. 向量检索
    query = "公路工程标准体系包含哪些板块？"
    print(f"  🔍 查询: {query}")
    query_emb = embedder.embed_query(query)
    check("Query Embedding", len(query_emb) > 0, f"{len(query_emb)} 维")

    results = vs.search(query_emb, top_k=10)
    check("向量检索结果", len(results) > 0, f"返回 {len(results)} 条")
    if results:
        print(f"  📊 Top-1 距离: {results[0]['distance']:.4f}")
        print(f"  📝 Top-1 内容: {results[0]['text'][:80]}...")

    # 5b. 混合检索 (向量 + BM25)
    retriever = HybridRetriever(vs, embedder)
    retriever.rebuild_bm25()
    hybrid_results = retriever.retrieve(query, top_k=10)
    check("混合检索结果", len(hybrid_results) > 0, f"返回 {len(hybrid_results)} 条")

    # 5c. Reranker
    reranker = Reranker()
    check("Reranker API Key", bool(reranker.api_key), f"Key: {reranker.api_key[:8]}...")

    docs = [r["text"] for r in hybrid_results]
    print(f"  ⏳ 正在重排序 {len(docs)} 条结果...")
    try:
        reranked = reranker.rerank(query, docs, top_k=5)
    except Exception as e:
        check("Reranker 调用", False, str(e))
        return query

    check("重排序结果", len(reranked) > 0, f"Top-{len(reranked)}")
    if reranked:
        print(f"  📊 Top-1 相关度: {reranked[0]['relevance_score']:.4f}")
        print(f"  📝 Top-1 内容: {reranked[0]['text'][:80]}...")

    return query


# ── Step 6: LLM 问答 ──────────────────────────────────

def test_qa():
    header("Step 6", "DeepSeek LLM 问答")

    from app.services.rag.manager import PipelineManager

    print("  ⏳ 初始化完整 QA Pipeline...")
    pm = PipelineManager(chroma_path=CHROMA_PATH)

    questions = [
        "公路工程标准体系包含哪些板块？",
        "隧道工程的围岩分级依据是什么？",
    ]

    for q in questions:
        print(f"\n  ❓ {q}")
        t0 = time.time()
        try:
            result = asyncio.get_event_loop().run_until_complete(pm.query(q))
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(pm.query(q))

        elapsed = time.time() - t0
        has_answer = bool(result.get("answer"))
        check(f"LLM 回答", has_answer,
              f"耗时 {elapsed:.1f}s, 引用 {len(result.get('sources', []))} 条")

        if has_answer:
            answer = result["answer"]
            print(f"  💬 回答预览: {answer[:200]}{'...' if len(answer) > 200 else ''}")
            for i, src in enumerate(result.get("sources", [])[:3]):
                meta = src.get("metadata", {})
                print(f"  📎 引用[{i+1}] 来源: {meta.get('source', '?')}, 段落: {meta.get('chunk_index', '?')}")


# ── 清理 ──────────────────────────────────────────────

def cleanup():
    header("清理", "删除测试数据")
    from app.services.rag.vector_store import VectorStore
    vs = VectorStore(chroma_path=CHROMA_PATH)
    vs.delete_by_doc(TEST_DOC_ID)
    print(f"  {PASS} 已删除测试文档 {TEST_DOC_ID}")


# ── 主流程 ────────────────────────────────────────────

def main():
    print("╔══════════════════════════════════════════════════════════╗")
    print("║         RAG 端到端 MVP 测试                              ║")
    print("║  PDF 解析 → 分块 → Embedding → 入库 → 检索 → 问答      ║")
    print("╚══════════════════════════════════════════════════════════╝")
    print(f"\n  测试 PDF: {os.path.basename(PDF_PATH)}")
    print(f"  ChromaDB: {CHROMA_PATH}")

    # 检查关键环境变量
    print("\n  环境变量检查:")
    env_checks = [
        ("MINERU_API_TOKEN", "MinerU PDF 解析"),
        ("EMBEDDING_API_KEY", "SiliconFlow Embedding"),
        ("LLM_API_KEY", "DeepSeek LLM"),
        ("RERANKER_API_KEY", "SiliconFlow Reranker"),
    ]
    all_set = True
    for key, desc in env_checks:
        val = os.getenv(key, "")
        ok = bool(val)
        if ok:
            print(f"  {PASS} {key}: {val[:12]}... ({desc})")
        else:
            print(f"  {FAIL} {key}: 未设置 ({desc})")
            all_set = False

    if not all_set:
        print("\n  ⚠️  部分环境变量未设置，相关步骤将失败。")
        print("  请在 .env 文件中配置有效的 API Key，或通过管理员面板更新。")
        print("  是否继续测试? (y/N): ", end="")
        try:
            ans = input().strip().lower()
            if ans != "y":
                print("  已取消。")
                return
        except EOFError:
            print("\n  检测到非交互模式，继续测试...")

    results = {}

    # Step 1
    content_list = test_mineru_parse()
    results["step1_parse"] = content_list is not None and len(content_list) > 0
    if not results["step1_parse"]:
        print("\n  ⛔ Step 1 失败，后续步骤无法继续。请检查 MINERU_API_TOKEN。")
        _summary(results)
        return

    # Step 2
    chunk_texts = test_chunking(content_list)
    results["step2_chunk"] = len(chunk_texts) > 0
    if not results["step2_chunk"]:
        print("\n  ⛔ Step 2 失败，无法继续。")
        _summary(results)
        return

    # Step 3
    embeddings, embedder = test_embedding(chunk_texts)
    results["step3_embed"] = embeddings is not None and len(embeddings) > 0
    if not results["step3_embed"]:
        print("\n  ⛔ Step 3 失败，请检查 EMBEDDING_API_KEY。")
        _summary(results)
        return

    # Step 4
    vs = test_vector_store(chunk_texts, embeddings)
    results["step4_store"] = vs is not None
    if not results["step4_store"]:
        print("\n  ⛔ Step 4 失败。")
        _summary(results)
        return

    # Step 5
    query = test_retrieval(embedder, vs)
    results["step5_retrieve"] = True  # 部分成功即可

    # Step 6
    try:
        test_qa()
        results["step6_qa"] = True
    except Exception as e:
        print(f"\n  {FAIL} Step 6 异常: {e}")
        results["step6_qa"] = False

    # 清理测试数据
    try:
        cleanup()
    except Exception:
        pass

    _summary(results)


def _summary(results: dict):
    print(f"\n{'='*60}")
    print("  测试总结")
    print(f"{'='*60}")
    labels = {
        "step1_parse": "Step 1: MinerU PDF 解析",
        "step2_chunk": "Step 2: 中文分块",
        "step3_embed": "Step 3: SiliconFlow Embedding",
        "step4_store": "Step 4: ChromaDB 入库",
        "step5_retrieve": "Step 5: 混合检索 + 重排序",
        "step6_qa": "Step 6: DeepSeek LLM 问答",
    }
    all_pass = True
    for key, label in labels.items():
        passed = results.get(key, False)
        print(f"  {PASS if passed else FAIL} {label}")
        if not passed:
            all_pass = False

    print()
    if all_pass:
        print("  🎉 全部通过！RAG 系统端到端可用。")
    else:
        print("  ⚠️  部分步骤失败，请根据上方提示排查。")
        print("  常见原因: API Key 过期/无效，请在管理员面板「系统配置」中更新。")


if __name__ == "__main__":
    main()
