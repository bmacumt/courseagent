"""Student routes: assignments, submissions, reports, Q&A."""
import json
import logging
import os
import shutil
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.auth.deps import require_role
from server.config import SUBMISSION_DIR
from server.db import engine as _db_engine
from server.db.engine import get_session
from server.db.models import User, Assignment, Submission, Report
from server.api.schemas import (
    AssignmentForStudent, AssignmentDetail,
    SubmitAnswer, SubmissionResponse, SubmissionSummary,
    ReportResponse, DimensionScoreItem,
    QARequest, QAResponse, QASourceItem,
)
from server.services.grading_service import GradingService  # noqa: lazy import in _run_grading_background
from server.services.rag_service import RAGService
from server.services.file_parser import parse_file

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/student", tags=["student"])
require_student = require_role("student")


# --- Assignments ---

@router.get("/assignments", response_model=list[AssignmentForStudent])
async def list_assignments(
    current_user: User = Depends(require_student),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Assignment)
        .where(Assignment.is_published == True)
        .order_by(Assignment.created_at.desc())
    )
    assignments = result.scalars().all()

    out = []
    for a in assignments:
        latest = await session.scalar(
            select(Submission)
            .where(Submission.assignment_id == a.id, Submission.student_id == current_user.id)
            .order_by(Submission.submitted_at.desc())
            .limit(1)
        )
        teacher = await session.get(User, a.teacher_id)
        out.append(AssignmentForStudent(
            id=a.id, title=a.title, description=a.description,
            question=a.question, deadline=a.deadline,
            teacher_name=teacher.real_name or teacher.username if teacher else None,
            has_submitted=latest is not None,
        ))
    return out


@router.get("/assignments/{assignment_id}", response_model=AssignmentDetail)
async def get_assignment(
    assignment_id: int,
    current_user: User = Depends(require_student),
    session: AsyncSession = Depends(get_session),
):
    assignment = await session.get(Assignment, assignment_id)
    if not assignment or not assignment.is_published:
        raise HTTPException(status_code=404, detail="Assignment not found")

    teacher = await session.get(User, assignment.teacher_id)
    return AssignmentDetail(
        id=assignment.id, title=assignment.title,
        description=assignment.description, question=assignment.question,
        reference_answer=assignment.reference_answer,
        deadline=assignment.deadline,
        teacher_name=teacher.real_name or teacher.username if teacher else None,
    )


# --- Submissions ---

@router.post("/assignments/{assignment_id}/submit")
async def submit_answer(
    assignment_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_student),
    session: AsyncSession = Depends(get_session),
    content: str = Form(None),
    file: UploadFile = File(None),
):
    assignment = await session.get(Assignment, assignment_id)
    if not assignment or not assignment.is_published:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if assignment.deadline and datetime.now(timezone.utc) > assignment.deadline:
        raise HTTPException(status_code=400, detail="Assignment deadline has passed")

    if not content and not file:
        raise HTTPException(status_code=400, detail="Must provide text content or upload a file")

    attachment_path = None
    final_content = content or ""

    if file:
        ext = file.filename.lower().split(".")[-1] if "." in file.filename else ""
        if ext not in ("pdf", "docx"):
            raise HTTPException(status_code=400, detail="File must be .pdf or .docx")

        os.makedirs(SUBMISSION_DIR, exist_ok=True)
        file_id = uuid.uuid4().hex[:12]
        save_name = f"{file_id}_{file.filename}"
        save_path = os.path.join(SUBMISSION_DIR, save_name)
        with open(save_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        try:
            parsed = parse_file(save_path, file.filename)
            if final_content:
                final_content = final_content + "\n\n--- 附件内容 ---\n" + parsed
            else:
                final_content = parsed
            attachment_path = save_path
        except Exception as e:
            if os.path.exists(save_path):
                os.remove(save_path)
            raise HTTPException(status_code=400, detail=f"Failed to parse file: {e}")

    submission = Submission(
        assignment_id=assignment_id,
        student_id=current_user.id,
        content=final_content,
        attachment_path=attachment_path,
        status="submitted",
    )
    session.add(submission)
    await session.commit()
    await session.refresh(submission)

    background_tasks.add_task(_run_grading_background, submission.id)
    return {"id": submission.id, "status": "submitted"}


async def _run_grading_background(submission_id: int):
    """Background task: creates its own DB session."""
    async with _db_engine.async_session() as session:
        grading = GradingService()
        await grading.run_grading(submission_id, session)


@router.get("/submissions", response_model=list[SubmissionSummary])
async def list_submissions(
    current_user: User = Depends(require_student),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Submission)
        .where(Submission.student_id == current_user.id)
        .order_by(Submission.submitted_at.desc())
    )
    submissions = result.scalars().all()

    summaries = []
    for s in submissions:
        report = await session.scalar(
            select(Report).where(Report.submission_id == s.id)
        )
        assignment = await session.get(Assignment, s.assignment_id)
        summaries.append(SubmissionSummary(
            id=s.id, assignment_id=s.assignment_id,
            student_name=current_user.username,
            student_real_name=current_user.real_name,
            status=s.status,
            submitted_at=s.submitted_at,
            total_score=report.total_score if report else None,
            has_attachment=s.attachment_path is not None,
        ))
    return summaries


@router.get("/submissions/{submission_id}/attachment")
async def download_attachment(
    submission_id: int,
    current_user: User = Depends(require_student),
    session: AsyncSession = Depends(get_session),
):
    submission = await session.get(Submission, submission_id)
    if not submission or submission.student_id != current_user.id:
        raise HTTPException(status_code=404, detail="Submission not found")
    if not submission.attachment_path or not os.path.exists(submission.attachment_path):
        raise HTTPException(status_code=404, detail="No attachment found")

    filename = os.path.basename(submission.attachment_path).split("_", 1)[-1]
    return FileResponse(
        submission.attachment_path,
        media_type="application/octet-stream",
        filename=filename,
    )


@router.get("/reports/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: int,
    current_user: User = Depends(require_student),
    session: AsyncSession = Depends(get_session),
):
    report = await session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    submission = await session.get(Submission, report.submission_id)
    if not submission or submission.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your report")

    return _format_report(report)


# --- Q&A ---

@router.post("/qa", response_model=QAResponse)
async def ask_question(
    req: QARequest,
    current_user: User = Depends(require_student),
):
    rag = RAGService()
    result = await rag.query(req.question)
    answer = result.get("answer", "")
    raw_sources = result.get("sources", [])
    source_items = []
    for s in raw_sources:
        if isinstance(s, dict):
            meta = s.get("metadata", {})
            source_items.append(QASourceItem(
                index=s.get("index", 0),
                text=s.get("text", "")[:500],
                source_name=meta.get("source"),
                chunk_index=meta.get("chunk_index"),
            ))
    return QAResponse(answer=answer, sources=source_items)


def _format_report(report: Report) -> ReportResponse:
    dims = []
    for d in json.loads(report.dimension_scores):
        dims.append(DimensionScoreItem(**d))
    return ReportResponse(
        id=report.id,
        submission_id=report.submission_id,
        total_score=report.total_score,
        max_score=report.max_score,
        dimension_scores=dims,
        feedback=report.feedback,
        references=json.loads(report.references),
        regulations_found=json.loads(report.regulations_found),
        regulations_cited=json.loads(report.regulations_cited),
        created_at=report.created_at,
    )
