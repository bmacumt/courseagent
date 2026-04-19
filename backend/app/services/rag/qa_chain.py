"""QA chain: retrieve -> rerank -> generate answer with citations."""
import json
import logging
from typing import AsyncGenerator

from app.services.rag.llm_client import LLMClient
from app.services.rag.embedder import Embedder
from app.services.rag.reranker import Reranker
from app.services.rag.retriever import HybridRetriever

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

    def _retrieve_context(self, question: str) -> tuple[str, list[dict], int, int]:
        """Retrieve + rerank, return (context, sources, num_retrieved, num_reranked)."""
        results = self.retriever.retrieve(question, top_k=self.retrieve_top_k)
        logger.info(f"Retrieved {len(results)} chunks for: {question[:50]}")

        if not results:
            return "", [], 0, 0

        doc_texts = [r["text"] for r in results]
        reranked = self.reranker.rerank(question, doc_texts, top_k=self.rerank_top_k)

        sources = []
        for i, r in enumerate(reranked):
            idx = r["index"]
            sources.append({
                "index": i + 1,
                "text": results[idx]["text"],
                "metadata": results[idx].get("metadata", {}),
                "relevance_score": r["relevance_score"],
            })

        context_parts = [f"[{s['index']}] {s['text']}" for s in sources]
        context = "\n\n".join(context_parts)
        return context, sources, len(results), len(reranked)

    async def answer(self, question: str) -> dict:
        context, sources, num_retrieved, num_reranked = self._retrieve_context(question)

        if not sources:
            return {
                "question": question,
                "answer": "抱歉，未找到与您的问题相关的参考资料。",
                "sources": [],
                "num_retrieved": 0,
                "num_reranked": 0,
            }

        user_msg = f"参考资料：\n{context}\n\n问题：{question}\n\n请根据以上参考资料回答问题，标注引用来源 [序号]。"
        answer = await self.llm.async_chat(SYSTEM_PROMPT, [{"role": "user", "content": user_msg}])

        return {
            "question": question,
            "answer": answer,
            "sources": sources,
            "num_retrieved": num_retrieved,
            "num_reranked": num_reranked,
        }

    async def stream_answer(self, question: str) -> AsyncGenerator[str, None]:
        """Yield SSE events: sources -> tokens -> done."""
        context, sources, num_retrieved, num_reranked = self._retrieve_context(question)

        if not sources:
            yield f"event: done\ndata: {json.dumps({'answer': '抱歉，未找到与您的问题相关的参考资料。'})}\n\n"
            return

        yield f"event: sources\ndata: {json.dumps(sources)}\n\n"

        user_msg = f"参考资料：\n{context}\n\n问题：{question}\n\n请根据以上参考资料回答问题，标注引用来源 [序号]。"
        async for token in self.llm.async_stream_chat(SYSTEM_PROMPT, [{"role": "user", "content": user_msg}]):
            yield f"event: token\ndata: {json.dumps({'content': token})}\n\n"

        yield "event: done\ndata: {}\n\n"
