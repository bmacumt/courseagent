"""Student routes: assignments, submissions, reports, Q&A."""
import json
import logging
import os
import shutil
import uuid
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import require_role
from app.config import SUBMISSION_DIR
from app.db import engine as _db_engine
from app.db.engine import get_session
from app.db.models import User, Assignment, Submission, Report, Conversation, ConversationMessage
from app.api.schemas import (
    AssignmentForStudent, AssignmentDetail,
    SubmitAnswer, SubmissionResponse, SubmissionSummary,
    ReportResponse, DimensionScoreItem, ManipulationWarningResponse,
    QARequest, QAResponse, QASourceItem,
    SaveMessagesRequest, ConversationCreateRequest, ConversationSummary, ConversationDetail, ConversationMessageItem,
)
from app.services.grading.service import GradingService  # noqa: lazy import in _run_grading_background
from app.services.rag_service import RAGService
from app.services.file_parser import parse_file

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
        grading_criteria=assignment.grading_criteria,
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

    if assignment.deadline and datetime.now() > assignment.deadline:
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
            assignment_title=assignment.title if assignment else None,
            student_name=current_user.username,
            student_real_name=current_user.real_name,
            status=s.status,
            submitted_at=s.submitted_at,
            total_score=report.total_score if report else None,
            has_attachment=s.attachment_path is not None,
            report_id=report.id if report else None,
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
    student = await session.get(User, submission.student_id)
    display_name = f"{student.student_id or student.username}_{student.real_name or student.username}_{filename}" if student else filename
    from urllib.parse import quote
    encoded = quote(display_name)
    ascii_name = display_name.encode("ascii", errors="replace").decode()
    return FileResponse(
        submission.attachment_path,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{encoded}"},
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

    assignment = await session.get(Assignment, submission.assignment_id)
    return _format_report(report, assignment)


# --- Q&A ---

def _history_to_dicts(history) -> list[dict]:
    """Convert ChatMessageInput list to dict list for LLM."""
    if not history:
        return []
    return [{"role": m.role, "content": m.content} for m in history[-10:]]


@router.post("/qa", response_model=QAResponse)
async def ask_question(
    req: QARequest,
    current_user: User = Depends(require_student),
    session: AsyncSession = Depends(get_session),
):
    history = _history_to_dicts(req.history)
    rag = RAGService()
    result = await rag.query(req.question, deep_research=req.deep_research, history=history)
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

    # Save messages to conversation
    if req.conversation_id:
        await _save_messages(session, req.conversation_id, current_user.id, req.question, answer)

    return QAResponse(answer=answer, sources=source_items)


@router.post("/qa/parse-report")
async def parse_report(
    file: UploadFile = File(...),
    current_user: User = Depends(require_student),
):
    """Parse an uploaded report file (PDF/DOCX) to plain text for diagnosis."""
    import tempfile
    from app.services.file_parser import parse_file
    suffix = os.path.splitext(file.filename or "")[1].lower()
    if suffix not in (".pdf", ".docx"):
        raise HTTPException(status_code=400, detail="仅支持 PDF 和 DOCX 格式")
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    try:
        text = parse_file(tmp_path, file.filename or "report.pdf")
    finally:
        os.unlink(tmp_path)
    if not text.strip():
        raise HTTPException(status_code=400, detail="文件内容为空或无法提取文字")
    return {"text": text}


@router.post("/qa/stream")
async def stream_question(
    req: QARequest,
    current_user: User = Depends(require_student),
):
    history = _history_to_dicts(req.history)
    rag = RAGService()

    async def generate():
        async for event in rag.stream_query(
            req.question, deep_research=req.deep_research,
            history=history, system_prompt=req.system_prompt,
        ):
            yield event

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _save_messages(session: AsyncSession, conversation_id: int, user_id: int, question: str, answer: str):
    """Save user question and AI response to conversation."""
    conv = await session.get(Conversation, conversation_id)
    if not conv or conv.user_id != user_id:
        return
    session.add(ConversationMessage(conversation_id=conversation_id, role="user", content=question))
    session.add(ConversationMessage(conversation_id=conversation_id, role="assistant", content=answer))
    conv.updated_at = datetime.now()
    await session.commit()


def _format_report(report: Report, assignment=None) -> ReportResponse:
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
        manipulation_warning=ManipulationWarningResponse(**json.loads(report.manipulation_warning)) if report.manipulation_warning else None,
        created_at=report.created_at,
        assignment_title=assignment.title if assignment else None,
    )

@router.get("/conversations", response_model=list[ConversationSummary])
async def list_conversations(
    current_user: User = Depends(require_student),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
    )
    return result.scalars().all()


@router.post("/conversations", response_model=ConversationSummary)
async def create_conversation(
    req: ConversationCreateRequest,
    current_user: User = Depends(require_student),
    session: AsyncSession = Depends(get_session),
):
    conv = Conversation(user_id=current_user.id, title=req.title[:100])
    session.add(conv)
    await session.commit()
    await session.refresh(conv)
    return conv


@router.post("/conversations/{conversation_id}/messages")
async def save_conversation_messages(
    conversation_id: int,
    req: SaveMessagesRequest,
    current_user: User = Depends(require_student),
    session: AsyncSession = Depends(get_session),
):
    """Save user question and AI answer to a conversation (called by frontend after streaming)."""
    conv = await session.get(Conversation, conversation_id)
    if not conv or conv.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    session.add(ConversationMessage(conversation_id=conversation_id, role="user", content=req.question))
    session.add(ConversationMessage(conversation_id=conversation_id, role="assistant", content=req.answer))
    conv.updated_at = datetime.now()
    await session.commit()
    return {"status": "saved"}


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: int,
    current_user: User = Depends(require_student),
    session: AsyncSession = Depends(get_session),
):
    conv = await session.get(Conversation, conversation_id)
    if not conv or conv.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")

    result = await session.execute(
        select(ConversationMessage)
        .where(ConversationMessage.conversation_id == conversation_id)
        .order_by(ConversationMessage.id)
    )
    messages = result.scalars().all()
    return ConversationDetail(
        id=conv.id, title=conv.title,
        messages=[ConversationMessageItem.model_validate(m) for m in messages],
        created_at=conv.created_at,
    )


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: int,
    current_user: User = Depends(require_student),
    session: AsyncSession = Depends(get_session),
):
    conv = await session.get(Conversation, conversation_id)
    if not conv or conv.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await session.delete(conv)
    await session.commit()
    return {"status": "deleted"}
