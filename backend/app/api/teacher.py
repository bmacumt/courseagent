"""Teacher routes: knowledge base CRUD, assignment CRUD, view submissions/reports."""
import csv
import logging
import io
import json
import os
import shutil
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import require_role
from app.config import UPLOAD_DIR
from app.db.engine import get_session, async_session
from app.db.models import User, Document, Assignment, Submission, Report
from app.api.schemas import (
    DocumentResponse, CreateAssignmentRequest, UpdateAssignmentRequest,
    AssignmentResponse, AssignmentSummary, SubmissionSummary, SubmissionDetail, ReportResponse,
    DimensionScoreItem,
)
from app.services.rag_service import RAGService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/teacher", tags=["teacher"])
require_teacher = require_role("teacher", "admin")


def _default_criteria_json() -> str:
    from app.services.grading.models import DEFAULT_CRITERIA
    return DEFAULT_CRITERIA.model_dump_json()


def _build_criteria_json(req_criteria) -> str:
    if req_criteria is None:
        return _default_criteria_json()

    dims = req_criteria.dimensions
    if not dims:
        return _default_criteria_json()

    criteria_dict = {
        "dimensions": dims,
        "reference_answer": req_criteria.reference_answer,
        "extra_instructions": req_criteria.extra_instructions,
        "max_score": 100,
    }
    return json.dumps(criteria_dict, ensure_ascii=False)


# --- Knowledge Base ---

VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}


@router.post("/knowledge", response_model=DocumentResponse)
async def upload_document(
    title: str = Form(...),
    doc_type: str = Form("book"),
    file: UploadFile = File(...),
    current_user: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_session),
):
    ext = os.path.splitext(file.filename.lower())[1]
    if ext == ".pdf":
        pass
    elif ext in VIDEO_EXTENSIONS:
        if doc_type != "mooc":
            raise HTTPException(status_code=400, detail="视频文件请选择「慕课视频」类型")
    else:
        raise HTTPException(status_code=400, detail=f"不支持的文件格式: {ext}，支持 PDF 和视频文件 (mp4/avi/mov/mkv/webm)")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_id = uuid.uuid4().hex[:12]
    save_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    doc = Document(
        doc_uuid=uuid.uuid4().hex,
        filename=file.filename,
        title=title,
        doc_type=doc_type,
        owner_id=current_user.id,
        chunk_count=0,
        parse_status="pending",
        file_path=save_path,
    )
    session.add(doc)
    await session.commit()
    await session.refresh(doc)
    return doc


async def _run_parse_background(doc_id: int):
    """Background task: parse a document (PDF → MinerU, Video → ASR, then chunk + embed)."""
    from app.db.engine import async_session
    async with async_session() as session:
        doc = await session.get(Document, doc_id)
        if not doc or not os.path.exists(doc.file_path):
            return

        doc.parse_status = "parsing"
        await session.commit()

        try:
            rag = RAGService()
            ext = os.path.splitext(doc.file_path)[1].lower()
            if ext in VIDEO_EXTENSIONS:
                result = rag.manager.ingest_video(doc.file_path, doc_id=doc.doc_uuid, doc_type=doc.doc_type)
            else:
                result = rag.manager.ingest_pdf(doc.file_path, doc_id=doc.doc_uuid, doc_type=doc.doc_type)
            if result.get("status") == "ok":
                doc.chunk_count = result["num_chunks"]
                doc.parse_status = "parsed"
            else:
                doc.parse_status = "failed"
                logger.warning("Parse failed for doc %s: %s", doc_id, result.get("error"))
        except Exception as e:
            doc.parse_status = "failed"
            logger.warning("Parse error for doc %s: %s", doc_id, e)

        await session.commit()


@router.post("/knowledge/{doc_id}/parse")
async def parse_document(
    doc_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_session),
):
    doc = await session.get(Document, doc_id)
    if not doc or doc.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.parse_status == "parsing":
        raise HTTPException(status_code=409, detail="Already parsing")
    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=400, detail="File not found on disk")

    # Delete old chunks if re-parsing
    if doc.parse_status == "parsed":
        rag = RAGService()
        rag.delete_document(doc.doc_uuid)
        doc.chunk_count = 0

    doc.parse_status = "parsing"
    await session.commit()

    background_tasks.add_task(_run_parse_background, doc_id)
    return {"status": "parsing", "doc_id": doc_id}


@router.get("/knowledge", response_model=list[DocumentResponse])
async def list_documents(
    current_user: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Document)
        .where(Document.owner_id == current_user.id)
        .order_by(Document.uploaded_at.desc())
    )
    return result.scalars().all()


@router.delete("/knowledge/{doc_id}")
async def delete_document(
    doc_id: int,
    current_user: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_session),
):
    doc = await session.get(Document, doc_id)
    if not doc or doc.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")

    rag = RAGService()
    rag.delete_document(doc.doc_uuid)

    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    await session.delete(doc)
    await session.commit()
    return {"status": "deleted"}


# --- Assignments ---

@router.post("/assignments", response_model=AssignmentResponse)
async def create_assignment(
    req: CreateAssignmentRequest,
    current_user: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_session),
):
    criteria_json = _build_criteria_json(req.grading_criteria)

    assignment = Assignment(
        teacher_id=current_user.id,
        title=req.title,
        description=req.description,
        question=req.question,
        reference_answer=req.reference_answer,
        grading_criteria=criteria_json,
        deadline=req.deadline,
    )
    session.add(assignment)
    await session.commit()
    await session.refresh(assignment)
    return assignment


@router.get("/assignments", response_model=list[AssignmentSummary])
async def list_assignments(
    current_user: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Assignment)
        .where(Assignment.teacher_id == current_user.id)
        .order_by(Assignment.created_at.desc())
    )
    assignments = result.scalars().all()

    summaries = []
    for a in assignments:
        count = await session.scalar(
            select(func.count(Submission.id)).where(Submission.assignment_id == a.id)
        )
        summaries.append(AssignmentSummary(
            id=a.id, title=a.title, is_published=a.is_published,
            deadline=a.deadline, created_at=a.created_at,
            submission_count=count or 0,
        ))
    return summaries


@router.put("/assignments/{assignment_id}", response_model=AssignmentResponse)
async def update_assignment(
    assignment_id: int,
    req: UpdateAssignmentRequest,
    current_user: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_session),
):
    assignment = await session.get(Assignment, assignment_id)
    if not assignment or assignment.teacher_id != current_user.id:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if assignment.is_published:
        raise HTTPException(status_code=400, detail="Cannot edit published assignment")

    if req.title is not None:
        assignment.title = req.title
    if req.description is not None:
        assignment.description = req.description
    if req.question is not None:
        assignment.question = req.question
    if req.reference_answer is not None:
        assignment.reference_answer = req.reference_answer
    if req.grading_criteria is not None:
        assignment.grading_criteria = _build_criteria_json(req.grading_criteria)
    if req.deadline is not None:
        assignment.deadline = req.deadline

    await session.commit()
    await session.refresh(assignment)
    return assignment


@router.put("/assignments/{assignment_id}/publish", response_model=AssignmentResponse)
async def publish_assignment(
    assignment_id: int,
    current_user: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_session),
):
    assignment = await session.get(Assignment, assignment_id)
    if not assignment or assignment.teacher_id != current_user.id:
        raise HTTPException(status_code=404, detail="Assignment not found")

    assignment.is_published = True
    await session.commit()
    await session.refresh(assignment)
    return assignment


@router.delete("/assignments/{assignment_id}")
async def delete_assignment(
    assignment_id: int,
    current_user: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_session),
):
    assignment = await session.get(Assignment, assignment_id)
    if not assignment or assignment.teacher_id != current_user.id:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if assignment.is_published:
        raise HTTPException(status_code=400, detail="Cannot delete published assignment")

    await session.delete(assignment)
    await session.commit()
    return {"status": "deleted"}


# --- Submissions & Reports (teacher view) ---

@router.get("/assignments/{assignment_id}/submissions", response_model=list[SubmissionSummary])
async def list_submissions(
    assignment_id: int,
    current_user: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_session),
):
    assignment = await session.get(Assignment, assignment_id)
    if not assignment or assignment.teacher_id != current_user.id:
        raise HTTPException(status_code=404, detail="Assignment not found")

    result = await session.execute(
        select(Submission)
        .where(Submission.assignment_id == assignment_id)
        .order_by(Submission.submitted_at.desc())
    )
    submissions = result.scalars().all()

    summaries = []
    for s in submissions:
        report = await session.scalar(
            select(Report).where(Report.submission_id == s.id)
        )
        student = await session.get(User, s.student_id)
        summaries.append(SubmissionSummary(
            id=s.id, assignment_id=s.assignment_id,
            student_name=student.username if student else None,
            student_real_name=student.real_name if student else None,
            student_id_field=student.student_id if student else None,
            class_name=student.class_name if student else None,
            status=s.status,
            submitted_at=s.submitted_at,
            total_score=report.total_score if report else None,
            has_attachment=s.attachment_path is not None,
            attachment_filename=os.path.basename(s.attachment_path).split("_", 1)[-1] if s.attachment_path else None,
            report_id=report.id if report else None,
        ))
    return summaries


@router.get("/reports/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: int,
    current_user: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_session),
):
    report = await session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    submission = await session.get(Submission, report.submission_id)
    assignment = None
    student = None
    if submission:
        assignment = await session.get(Assignment, submission.assignment_id)
        if not assignment or assignment.teacher_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not your assignment")
        student = await session.get(User, submission.student_id)

    return _format_report(report, assignment, student)


@router.get("/submissions/{submission_id}/attachment")
async def download_attachment(
    submission_id: int,
    current_user: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_session),
):
    submission = await session.get(Submission, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    assignment = await session.get(Assignment, submission.assignment_id)
    if not assignment or assignment.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your assignment")

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


@router.get("/submissions/{submission_id}", response_model=SubmissionDetail)
async def get_submission_detail(
    submission_id: int,
    current_user: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_session),
):
    submission = await session.get(Submission, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    assignment = await session.get(Assignment, submission.assignment_id)
    if not assignment or assignment.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your assignment")

    student = await session.get(User, submission.student_id)
    return SubmissionDetail(
        id=submission.id,
        assignment_id=submission.assignment_id,
        student_name=student.username if student else None,
        student_real_name=student.real_name if student else None,
        student_id_field=student.student_id if student else None,
        class_name=student.class_name if student else None,
        content=submission.content,
        has_attachment=submission.attachment_path is not None,
        attachment_filename=os.path.basename(submission.attachment_path).split("_", 1)[-1] if submission.attachment_path else None,
        status=submission.status,
        submitted_at=submission.submitted_at,
    )


def _format_report(report: Report, assignment=None, student=None) -> ReportResponse:
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
        student_real_name=student.real_name if student else None,
        assignment_title=assignment.title if assignment else None,
    )


# --- Export ---

@router.get("/assignments/{assignment_id}/export")
async def export_grades(
    assignment_id: int,
    current_user: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_session),
):
    assignment = await session.get(Assignment, assignment_id)
    if not assignment or assignment.teacher_id != current_user.id:
        raise HTTPException(status_code=404, detail="Assignment not found")

    result = await session.execute(
        select(Submission)
        .where(Submission.assignment_id == assignment_id)
        .order_by(Submission.submitted_at.desc())
    )
    submissions = result.scalars().all()

    dims = []
    try:
        criteria = json.loads(assignment.grading_criteria)
        dims = [d["label"] for d in criteria.get("dimensions", [])]
    except Exception:
        pass

    output = io.StringIO()
    writer = csv.writer(output)
    header = ["学号", "姓名", "班级", "提交状态", "总分"]
    for d in dims:
        header.append(d)
    header.extend(["评语", "提交时间"])
    writer.writerow(header)

    for s in submissions:
        student = await session.get(User, s.student_id)
        report = await session.scalar(
            select(Report).where(Report.submission_id == s.id)
        )

        row = [
            student.student_id if student else "",
            student.real_name if student else "",
            student.class_name if student else "",
            s.status,
            report.total_score if report else "",
        ]

        if report and dims:
            try:
                ds = json.loads(report.dimension_scores)
                dim_map = {d["label"]: d["score"] for d in ds}
                for d in dims:
                    row.append(dim_map.get(d, ""))
            except Exception:
                row.extend([""] * len(dims))
        else:
            row.extend([""] * len(dims))

        row.append(report.feedback if report else "")
        row.append(str(s.submitted_at) if s.submitted_at else "")
        writer.writerow(row)

    output.seek(0)
    content = "\ufeff" + output.getvalue()
    from urllib.parse import quote
    filename = quote(f"{assignment.title}_grades.csv")
    return StreamingResponse(
        iter([content]),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )
