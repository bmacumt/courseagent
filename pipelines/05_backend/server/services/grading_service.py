"""Grading service: wraps 04_grading GradingAgent with DB persistence."""
import json
import logging
import os
import sys

from server.config import CHROMA_PATH, GRADING_PATH

if GRADING_PATH not in sys.path:
    sys.path.insert(0, GRADING_PATH)

from grading.agent import GradingAgent
from grading.models import GradingCriteria
from grading.rag_bridge import RAGBridge

logger = logging.getLogger(__name__)


class GradingService:
    def __init__(self):
        self.rag_bridge = RAGBridge(chroma_path=CHROMA_PATH)
        self.agent = GradingAgent(self.rag_bridge)

    async def run_grading(self, submission_id: int, session) -> None:
        """Grade a submission and persist the report. Caller must provide a session."""
        from server.db.models import Assignment, Submission, Report

        submission = await session.get(Submission, submission_id)
        if not submission:
            logger.error(f"Submission {submission_id} not found")
            return

        assignment = await session.get(Assignment, submission.assignment_id)
        if not assignment:
            submission.status = "failed"
            await session.commit()
            return

        submission.status = "grading"
        await session.commit()

        try:
            criteria = GradingCriteria.model_validate_json(assignment.grading_criteria)
            report = await self.agent.grade(
                question=assignment.question,
                student_answer=submission.content,
                criteria=criteria,
            )

            db_report = Report(
                submission_id=submission_id,
                total_score=report.total_score,
                max_score=report.max_score,
                dimension_scores=json.dumps(
                    [d.model_dump() for d in report.dimensions], ensure_ascii=False
                ),
                feedback=report.feedback,
                references=json.dumps(report.references, ensure_ascii=False),
                regulations_found=json.dumps(report.regulations_found, ensure_ascii=False),
                regulations_cited=json.dumps(report.regulations_cited, ensure_ascii=False),
            )
            session.add(db_report)
            submission.status = "graded"
            await session.commit()
            logger.info(f"[grading] submission {submission_id}: {report.total_score}/{report.max_score}")

        except Exception as e:
            submission.status = "failed"
            await session.commit()
            logger.error(f"[grading] submission {submission_id} failed: {e}")
