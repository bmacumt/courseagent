"""Generate grading demo results for documentation."""
import asyncio
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

RAG_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "03_rag"))
if RAG_PATH not in sys.path:
    sys.path.insert(0, RAG_PATH)

from app.chunking.mineru_adapter import mineru_to_sections
from app.chunking.laws_chunker import chunk
from app.embedder import Embedder
from app.vector_store import VectorStore

from grading.agent import GradingAgent
from grading.rag_bridge import RAGBridge


def setup_kb(chroma_path):
    output_dir = os.path.join(RAG_PATH, "output", "JTG 1001-2017 公路工程标准体系")
    content_json = None
    for f in os.listdir(output_dir):
        if "content_list" in f and f.endswith(".json"):
            content_json = os.path.join(output_dir, f)
            break
    with open(content_json) as f:
        cl = json.load(f)
    sections = mineru_to_sections(cl)
    chunks_result = chunk(sections, lang="zh")
    chunk_texts = [c for c in chunks_result if c.strip()]
    embedder = Embedder()
    embeddings = embedder.embed_texts(chunk_texts)
    vs = VectorStore(chroma_path=chroma_path, collection_name="grading_demo")
    meta = [{"doc_id": "jtg_1001", "chunk_index": i} for i in range(len(chunk_texts))]
    vs.add_chunks("jtg_1001", chunk_texts, embeddings, meta)
    return len(chunk_texts)


CASES = [
    {
        "name": "优秀答案",
        "question": "请阐述公路工程标准体系的总体框架结构，包括板块和模块的划分。",
        "answer": (
            "公路工程标准体系（JTG 1001-2017）采用三层结构：板块、模块和标准。\n\n"
            "体系共分为六大板块：总体、通用、公路建设、公路管理、公路养护、公路运营。"
            "这体现了\"建、管、养、运\"四位一体协调发展的总体思想。\n\n"
            "通用板块划分为基础、安全、绿色、智慧四个模块。其中基础模块包括工程技术标准、质量检验评定等；"
            "安全模块涉及安全评价和风险防控；绿色模块关注生态保护与节能；智慧模块引入信息化和新技术。\n\n"
            "公路建设板块包含勘测、设计、试验、检测、施工、监理、项目管理、造价共8个模块。"
            "本次修订新增了项目管理模块，以加强工程项目的规范化管理。\n\n"
            "我认为这个体系结构的创新之处在于将\"运营\"单独设为板块，体现了从重建设到重管理的转变趋势。"
            "未来智慧公路模块可能会与车路协同技术深度融合，推动公路运营方式的根本变革。"
        ),
    },
    {
        "name": "中等答案",
        "question": "通用板块包含哪些模块？各自的功能是什么？",
        "answer": (
            "通用板块分为基础、安全、绿色、智慧四个模块。\n\n"
            "基础模块主要是一些技术标准，比如工程技术标准这些。安全模块是关于施工安全和运营安全的。"
            "绿色模块涉及环保方面的内容。智慧模块是信息化相关的标准。\n\n"
            "总体来说通用板块是各板块共性要求的总结。"
        ),
    },
    {
        "name": "较差答案",
        "question": "公路建设板块包含哪些模块？为什么新增了项目管理模块？",
        "answer": "公路建设板块好像有勘测、设计、施工几个模块吧，其他的记不太清了。新增项目管理可能是因为现在工程越来越复杂了。",
    },
    {
        "name": "偏题答案（知识库无相关规范）",
        "question": "请详细介绍新奥法隧道施工的工艺流程及适用条件。",
        "answer": (
            "新奥法是利用围岩自承能力的施工方法，适用于岩质较好的隧道。"
            "主要工序包括：超前支护、开挖、初期支护、监测、二次衬砌。"
            "优点是灵活、经济，缺点是对地质条件依赖较大。"
        ),
    },
]


async def run():
    with tempfile.TemporaryDirectory() as tmpdir:
        n = setup_kb(tmpdir)
        print(f"KB: {n} chunks")
        bridge = RAGBridge(chroma_path=tmpdir)
        agent = GradingAgent(bridge)

        results = []
        for i, case in enumerate(CASES):
            print(f"Grading case {i+1}/{len(CASES)}: {case['name']}...")
            report = await agent.grade(case["question"], case["answer"])
            results.append({
                "case_name": case["name"],
                "question": case["question"],
                "answer": case["answer"],
                "report": report.model_dump(),
            })
            print(f"  Score: {report.total_score}")

        with open("/tmp/grading_results.json", "w") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print("Saved to /tmp/grading_results.json")


if __name__ == "__main__":
    asyncio.run(run())
