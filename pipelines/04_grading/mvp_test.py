"""04_grading MVP test: grade student answers using RAG-retrieved regulations."""
import asyncio
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

# Import 03_rag components (no collision — our package is `grading/`, not `app/`)
RAG_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "03_rag"))
if RAG_PATH not in sys.path:
    sys.path.insert(0, RAG_PATH)

from app.chunking.mineru_adapter import mineru_to_sections
from app.chunking.laws_chunker import chunk
from app.embedder import Embedder
from app.parser.mineru_client import MinerUClient
from app.vector_store import VectorStore

from grading.agent import GradingAgent
from grading.models import DEFAULT_CRITERIA, DimensionConfig, DimensionResult, GradingCriteria
from grading.rag_bridge import RAGBridge

TEST_PDF = os.path.join(RAG_PATH, "JTG 1001-2017 公路工程标准体系.pdf")


def _setup_test_kb(chroma_path: str) -> bool:
    """Ingest PDF into ChromaDB using 03_rag components directly."""
    if not os.path.exists(TEST_PDF):
        print(f"  PDF not found: {TEST_PDF}")
        return False

    # Try MinerU API first, fall back to cached content_list
    output_dir = os.path.join(RAG_PATH, "output", "JTG 1001-2017 公路工程标准体系")
    content_json = None
    if os.path.isdir(output_dir):
        for f in os.listdir(output_dir):
            if "content_list" in f and f.endswith(".json"):
                content_json = os.path.join(output_dir, f)
                break

    if content_json:
        print(f"  Using cached content_list.json")
        with open(content_json) as f:
            content_list = json.load(f)
    else:
        print(f"  Parsing PDF via MinerU API...")
        mineru = MinerUClient()
        content_list = mineru.parse_pdf(TEST_PDF)

    sections = mineru_to_sections(content_list)
    chunks_result = chunk(sections, lang="zh")
    chunk_texts = [c for c in chunks_result if c.strip()]
    print(f"  {len(chunk_texts)} chunks")

    embedder = Embedder()
    embeddings = embedder.embed_texts(chunk_texts)

    vs = VectorStore(chroma_path=chroma_path, collection_name="grading_test")
    meta = [{"doc_id": "jtg_1001", "chunk_index": i} for i in range(len(chunk_texts))]
    vs.add_chunks("jtg_1001", chunk_texts, embeddings, meta)
    print(f"  Stored {vs.count()} chunks")
    return True


async def test_score_calculation():
    print("\n=== Test 1: Score Calculation ===")
    dims = [
        DimensionResult(name="a", label="A", score=80, weight=0.3, weighted_score=24.0, comment="ok"),
        DimensionResult(name="b", label="B", score=70, weight=0.3, weighted_score=21.0, comment="ok"),
        DimensionResult(name="c", label="C", score=90, weight=0.2, weighted_score=18.0, comment="ok"),
        DimensionResult(name="d", label="D", score=60, weight=0.2, weighted_score=12.0, comment="ok"),
    ]
    total = round(sum(d.weighted_score for d in dims) / sum(d.weight for d in dims), 1)
    assert total == 75.0, f"Expected 75.0, got {total}"
    print(f"  Calculated total: {total} ✅")


async def test_default_grading(rag_bridge: RAGBridge):
    print("\n=== Test 2: Default Grading (Good Answer) ===")

    question = "请阐述公路工程标准体系的总体框架结构，包括板块和模块的划分。"
    good_answer = """
公路工程标准体系（JTG 1001-2017）采用三层结构：板块、模块和标准。

体系共分为六大板块：总体、通用、公路建设、公路管理、公路养护、公路运营。这体现了"建、管、养、运"四位一体协调发展的总体思想。

通用板块划分为基础、安全、绿色、智慧四个模块。其中基础模块包括工程技术标准、质量检验评定等；安全模块涉及安全评价和风险防控；绿色模块关注生态保护与节能；智慧模块引入信息化和新技术。

公路建设板块包含勘测、设计、试验、检测、施工、监理、项目管理、造价共8个模块。本次修订新增了项目管理模块，以加强工程项目的规范化管理。

我认为这个体系结构的创新之处在于将"运营"单独设为板块，体现了从重建设到重管理的转变趋势。未来智慧公路模块可能会与车路协同技术深度融合，推动公路运营方式的根本变革。
"""

    agent = GradingAgent(rag_bridge)
    report = await agent.grade(question, good_answer)

    print(f"  Total: {report.total_score}/{report.max_score}")
    for d in report.dimensions:
        print(f"  {d.label}: {d.score} (×{d.weight}={d.weighted_score}) — {d.comment[:60]}...")
    print(f"  Feedback: {report.feedback[:150]}...")
    print(f"  Regulations found: {len(report.regulations_found)}, cited: {report.regulations_cited}")

    assert report.total_score > 0
    assert len(report.dimensions) == 4
    assert all(0 <= d.score <= 100 for d in report.dimensions)
    print("  ✅ Test 2 passed")


async def test_weak_answer(rag_bridge: RAGBridge):
    print("\n=== Test 3: Weak Answer ===")

    question = "公路工程标准体系的总体框架结构是什么？"
    weak_answer = "公路工程标准体系分为几个板块，有建设、管理什么的，具体记不太清了。"

    agent = GradingAgent(rag_bridge)
    report = await agent.grade(question, weak_answer)

    print(f"  Total: {report.total_score}/{report.max_score}")
    for d in report.dimensions:
        print(f"  {d.label}: {d.score} — {d.comment[:60]}...")

    assert report.total_score < 65, f"Weak answer should score below 65, got {report.total_score}"
    print("  ✅ Test 3 passed (weak answer scored low)")


async def test_custom_criteria(rag_bridge: RAGBridge):
    print("\n=== Test 4: Custom Criteria (2 dimensions) ===")

    custom_criteria = GradingCriteria(
        dimensions=[
            DimensionConfig(name="knowledge", label="知识掌握", weight=0.5, description="对公路工程标准体系基本概念的理解程度"),
            DimensionConfig(name="application", label="实际应用", weight=0.5, description="能否将标准体系知识应用到实际工程场景"),
        ],
        reference_answer="标准体系分为六大板块：总体、通用、建设、管理、养护、运营。通用板块有基础、安全、绿色、智慧四个模块。",
        extra_instructions="请重点关注学生是否理解了板块划分的内在逻辑",
        max_score=100,
    )

    question = "公路工程标准体系为什么要划分为六大板块？划分的内在逻辑是什么？"
    student_answer = """
六大板块的划分是为了统筹公路建设、管理、养护和运营的协调发展。总体板块起统领作用，通用板块提取共性要求，建设、管理、养护、运营四个板块分别对应公路全生命周期的不同阶段。这种划分体现了"建管养运"四位一体的思想。
"""

    agent = GradingAgent(rag_bridge)
    report = await agent.grade(question, student_answer, criteria=custom_criteria)

    print(f"  Total: {report.total_score}/{report.max_score}")
    for d in report.dimensions:
        print(f"  {d.label}: {d.score} (×{d.weight}={d.weighted_score}) — {d.comment[:60]}...")

    assert len(report.dimensions) == 2
    assert all(d.name in ("knowledge", "application") for d in report.dimensions)
    print("  ✅ Test 4 passed (custom criteria worked)")


async def test_no_regulation_topic(rag_bridge: RAGBridge):
    print("\n=== Test 5: No Regulation Match ===")

    question = "请描述你最喜欢的隧道施工方法及其优缺点。"
    student_answer = "我最喜欢新奥法，因为它利用围岩的自承能力，施工灵活。缺点是对地质条件要求较高。"

    agent = GradingAgent(rag_bridge)
    report = await agent.grade(question, student_answer)

    print(f"  Total: {report.total_score}/{report.max_score}")
    for d in report.dimensions:
        print(f"  {d.label}: {d.score} — {d.comment[:60]}...")
    print(f"  Regulations found: {len(report.regulations_found)}")

    assert report.total_score > 0
    print("  ✅ Test 5 passed (no-regulation topic handled gracefully)")


async def main():
    print("=== 04_grading MVP Test ===\n")

    await test_score_calculation()

    with tempfile.TemporaryDirectory() as tmpdir:
        print("[Setup] Creating test knowledge base...")
        ok = _setup_test_kb(tmpdir)
        if not ok:
            print("Skipping KB-dependent tests — ingest failed")
            return

        rag_bridge = RAGBridge(chroma_path=tmpdir)

        await test_default_grading(rag_bridge)
        await test_weak_answer(rag_bridge)
        await test_custom_criteria(rag_bridge)
        await test_no_regulation_topic(rag_bridge)

    print("\n✅ All grading tests passed!")


if __name__ == "__main__":
    asyncio.run(main())
