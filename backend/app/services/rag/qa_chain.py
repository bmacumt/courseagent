"""QA chain: retrieve → rerank → generate answer with citations."""
import logging

from app.services.rag.llm_client import LLMClient
from app.services.rag.embedder import Embedder
from app.services.rag.reranker import Reranker
from app.services.rag.retriever import HybridRetriever
from app.services.rag.prompts.loader import render_prompt

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """你是隧道工程课程智能助教。请根据提供的参考资料回答学生的问题。

要求：
1. 回答必须基于参考资料，不要编造内容
2. 如果参考资料不足以回答问题，请明确说明
3. 在回答中标注引用来源，格式为 [序号]
4. 回答要准确、专业、易于理解"""


class QAChain:
    def __init__(
        self,
        retriever: HybridRetriever,
        embedder: Embedder,
        reranker: Reranker,
        llm: LLMClient,
        retrieve_top_k: int = 20,
        rerank_top_k: int = 5,
    ):
        self.retriever = retriever
        self.embedder = embedder
        self.reranker = reranker
        self.llm = llm
        self.retrieve_top_k = retrieve_top_k
        self.rerank_top_k = rerank_top_k

    async def answer(self, question: str) -> dict:
        """Answer a question using RAG pipeline.

        Returns:
            {
                "question": str,
                "answer": str,
                "sources": list[dict],  # cited chunks
                "num_retrieved": int,
                "num_reranked": int,
            }
        """
        # 1. Retrieve
        results = self.retriever.retrieve(question, top_k=self.retrieve_top_k)
        logger.info(f"Retrieved {len(results)} chunks for: {question[:50]}")

        if not results:
            return {
                "question": question,
                "answer": "抱歉，未找到与您的问题相关的参考资料。",
                "sources": [],
                "num_retrieved": 0,
                "num_reranked": 0,
            }

        # 2. Rerank
        doc_texts = [r["text"] for r in results]
        reranked = self.reranker.rerank(question, doc_texts, top_k=self.rerank_top_k)

        # Build cited sources
        sources = []
        for i, r in enumerate(reranked):
            idx = r["index"]
            sources.append({
                "index": i + 1,
                "text": results[idx]["text"],
                "metadata": results[idx].get("metadata", {}),
                "relevance_score": r["relevance_score"],
            })

        # 3. Build context
        context_parts = []
        for s in sources:
            context_parts.append(f"[{s['index']}] {s['text']}")
        context = "\n\n".join(context_parts)

        # 4. Generate answer
        user_msg = f"参考资料：\n{context}\n\n问题：{question}\n\n请根据以上参考资料回答问题，标注引用来源 [序号]。"
        answer = await self.llm.async_chat(SYSTEM_PROMPT, [{"role": "user", "content": user_msg}])

        return {
            "question": question,
            "answer": answer,
            "sources": sources,
            "num_retrieved": len(results),
            "num_reranked": len(reranked),
        }
