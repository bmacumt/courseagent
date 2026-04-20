"""Grading agent: orchestrates RAG retrieval + dimension scoring + feedback."""
import asyncio
import logging

from app.services.grading.models import DEFAULT_CRITERIA, DimensionResult, GradingCriteria, GradingReport, ManipulationWarning
from app.services.grading.rag_bridge import RAGBridge
from app.services.grading.scorer import check_regulations, detect_manipulation, generate_feedback, score_dimension
from app.services.rag.llm_client import LLMClient

logger = logging.getLogger(__name__)


class GradingAgent:
    def __init__(self, rag_bridge: RAGBridge, llm: LLMClient | None = None):
        self.rag = rag_bridge
        self.llm = llm or LLMClient()

    async def grade(
        self,
        question: str,
        student_answer: str,
        criteria: GradingCriteria | None = None,
    ) -> GradingReport:
        """Full grading pipeline: RAG retrieve → score dimensions → verify regulations → summarize."""
        criteria = criteria or DEFAULT_CRITERIA

        # Step 0: Manipulation detection
        logger.info(f"[grade] Checking for manipulative language")
        manip_result = await detect_manipulation(self.llm, student_answer)
        manipulation_warning = None
        manip_summary = None
        if manip_result.get("detected"):
            manipulation_warning = ManipulationWarning(**manip_result)
            manip_summary = f"检测到诱导性语句（{manip_result['severity']}级别）：{'; '.join(manip_result.get('fragments', []))}"
            logger.info(f"[grade] Manipulation detected: {manip_result['severity']} — {manip_result.get('fragments', [])}")

        # Step 1: RAG retrieval
        logger.info(f"[grade] Retrieving regulations for: {question[:50]}")
        regulations = self.rag.retrieve_regulations(question, top_k=8)
        regulations_text = "\n\n".join(
            [f"[{i+1}] {r['text']}" for i, r in enumerate(regulations)]
        ) if regulations else None
        logger.info(f"[grade] Found {len(regulations)} regulation chunks")

        # Step 2: Score each dimension (parallel)
        logger.info(f"[grade] Scoring {len(criteria.dimensions)} dimensions")
        dimension_tasks = []
        for dim in criteria.dimensions:
            dim_regulations = regulations_text
            dimension_tasks.append(
                score_dimension(
                    self.llm,
                    dimension=dim,
                    question=question,
                    student_answer=student_answer,
                    reference_answer=criteria.reference_answer,
                    regulations=dim_regulations,
                    extra_instructions=criteria.extra_instructions,
                )
            )

        dimension_results: list[DimensionResult] = await asyncio.gather(*dimension_tasks)

        # Step 3: Regulation verification
        regulations_found = []
        regulations_cited = []
        reg_summary = None

        if regulations:
            reg_result = await check_regulations(
                self.llm, question, student_answer, regulations_text,
            )
            regulations_found = [r["text"][:100] for r in regulations]
            regulations_cited = reg_result.get("cited_regulations", [])
            uncited = reg_result.get("uncited_regulations", [])
            reg_summary = reg_result.get("compliance_comment", "")
            if uncited:
                reg_summary += f"\n未引用但相关的规范：{'; '.join(uncited[:3])}"

        # Step 4: Calculate total score (backend arithmetic)
        total_weighted = sum(d.weighted_score for d in dimension_results)
        total_weight = sum(d.weight for d in criteria.dimensions)
        total_score = round(total_weighted / total_weight, 1)

        # Step 5: Generate overall feedback
        feedback = await generate_feedback(
            self.llm,
            question=question,
            student_answer=student_answer,
            dimension_results=dimension_results,
            total_score=total_score,
            max_score=criteria.max_score,
            regulations_summary=reg_summary,
            manipulation_summary=manip_summary,
        )

        references = [r["text"][:150] for r in regulations[:5]] if regulations else []

        report = GradingReport(
            total_score=total_score,
            max_score=criteria.max_score,
            dimensions=dimension_results,
            feedback=feedback,
            references=references,
            regulations_found=regulations_found[:5],
            regulations_cited=regulations_cited[:5],
            manipulation_warning=manipulation_warning,
        )

        logger.info(f"[grade] Done: total={total_score}/{criteria.max_score}")
        return report
