"""Pydantic request/response schemas for all API endpoints."""
from datetime import datetime

from pydantic import BaseModel, Field


# --- Auth ---

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    email: str = Field(..., pattern=r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
    code: str = Field(..., min_length=6, max_length=6)
    password: str

class SendCodeRequest(BaseModel):
    email: str = Field(..., pattern=r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
    purpose: str = Field(..., pattern=r'^(register|reset_password)$')

class ResetPasswordRequest(BaseModel):
    email: str = Field(..., pattern=r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
    code: str = Field(..., min_length=6, max_length=6)
    new_password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    is_registered: bool = True
    real_name: str | None = None
    student_id: str | None = None
    class_name: str | None = None
    email: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


# --- Admin: User management ---

class CreateUserRequest(BaseModel):
    username: str
    role: str = "student"
    real_name: str | None = None
    student_id: str | None = None
    class_name: str | None = None
    email: str | None = None

class UpdateUserRequest(BaseModel):
    real_name: str | None = None
    class_name: str | None = None
    password: str | None = None

class BatchStudentItem(BaseModel):
    username: str
    real_name: str
    student_id: str
    class_name: str

class BatchStudentRequest(BaseModel):
    students: list[BatchStudentItem]

class BatchImportResult(BaseModel):
    success_count: int
    failed: list[dict]
    created_ids: list[int]

class SystemStats(BaseModel):
    total_users: int
    total_documents: int
    total_assignments: int
    total_submissions: int


# --- Admin: Settings ---

class SettingItem(BaseModel):
    id: int
    key: str
    value: str
    category: str
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}

class SettingUpdate(BaseModel):
    value: str


# --- Teacher: Knowledge ---

class DocumentResponse(BaseModel):
    id: int
    doc_uuid: str
    filename: str
    title: str
    doc_type: str
    owner_id: int
    chunk_count: int
    parse_status: str = "pending"
    uploaded_at: datetime | None = None

    model_config = {"from_attributes": True}


# --- Teacher: Assignments ---

class GradingCriteriaInput(BaseModel):
    """Simplified criteria input for assignment creation."""
    dimensions: list[dict] | None = None  # [{name, label, weight, description}]
    reference_answer: str | None = None
    extra_instructions: str | None = None

class CreateAssignmentRequest(BaseModel):
    title: str
    description: str
    question: str
    reference_answer: str | None = None
    grading_criteria: GradingCriteriaInput | None = None
    deadline: datetime | None = None

class UpdateAssignmentRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    question: str | None = None
    reference_answer: str | None = None
    grading_criteria: GradingCriteriaInput | None = None
    deadline: datetime | None = None

class AssignmentResponse(BaseModel):
    id: int
    teacher_id: int
    title: str
    description: str
    question: str
    reference_answer: str | None = None
    grading_criteria: str  # JSON string
    deadline: datetime | None = None
    is_published: bool
    created_at: datetime | None = None

    model_config = {"from_attributes": True}

class AssignmentSummary(BaseModel):
    id: int
    title: str
    is_published: bool
    deadline: datetime | None = None
    created_at: datetime | None = None
    submission_count: int = 0

    model_config = {"from_attributes": True}


# --- Student: Assignments view ---

class AssignmentForStudent(BaseModel):
    id: int
    title: str
    description: str
    question: str
    deadline: datetime | None = None
    teacher_name: str | None = None
    has_submitted: bool = False

class AssignmentDetail(BaseModel):
    id: int
    title: str
    description: str
    question: str
    reference_answer: str | None = None
    grading_criteria: str | None = None
    deadline: datetime | None = None
    teacher_name: str | None = None


# --- Student: Submissions ---

class SubmitAnswer(BaseModel):
    content: str

class SubmissionResponse(BaseModel):
    id: int
    assignment_id: int
    student_id: int
    content: str
    status: str
    submitted_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}

class SubmissionSummary(BaseModel):
    id: int
    assignment_id: int
    assignment_title: str | None = None
    student_name: str | None = None
    student_real_name: str | None = None
    student_id_field: str | None = None
    class_name: str | None = None
    status: str
    submitted_at: datetime | None = None
    total_score: float | None = None
    has_attachment: bool = False
    attachment_filename: str | None = None
    report_id: int | None = None

class SubmissionDetail(BaseModel):
    id: int
    assignment_id: int
    student_name: str | None = None
    student_real_name: str | None = None
    student_id_field: str | None = None
    class_name: str | None = None
    content: str
    has_attachment: bool = False
    attachment_filename: str | None = None
    status: str
    submitted_at: datetime | None = None


# --- Reports ---

class DimensionScoreItem(BaseModel):
    name: str
    label: str
    score: int
    weight: float
    weighted_score: float
    comment: str

class ReportResponse(BaseModel):
    id: int
    submission_id: int
    total_score: float
    max_score: int
    dimension_scores: list[DimensionScoreItem]
    feedback: str
    references: list[str]
    regulations_found: list[str]
    regulations_cited: list[str]
    created_at: datetime | None = None
    student_real_name: str | None = None
    assignment_title: str | None = None


# --- Student: QA ---

class ChatMessageInput(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class QARequest(BaseModel):
    question: str
    deep_research: bool = False
    conversation_id: int | None = None
    history: list[ChatMessageInput] | None = None

class QASourceItem(BaseModel):
    index: int
    text: str
    source_name: str | None = None
    chunk_index: int | None = None

class QAResponse(BaseModel):
    answer: str
    sources: list[QASourceItem]


# --- Model Management ---

class AddProviderRequest(BaseModel):
    provider_type: str
    api_key: str
    base_url: str | None = None

class UpdateProviderRequest(BaseModel):
    api_key: str | None = None
    base_url: str | None = None
    enabled: bool | None = None

class AddModelRequest(BaseModel):
    model_name: str
    model_type: str
    max_tokens: int = 4096
    is_default: bool = False

class SetDefaultRequest(BaseModel):
    model_type: str
    model_id: int


# --- Student: Conversations ---

class ConversationCreateRequest(BaseModel):
    title: str

class ConversationSummary(BaseModel):
    id: int
    title: str
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}

class ConversationMessageItem(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}

class ConversationDetail(BaseModel):
    id: int
    title: str
    messages: list[ConversationMessageItem]
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
