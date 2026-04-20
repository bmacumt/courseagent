// Types matching backend schemas exactly

export type Role = 'admin' | 'teacher' | 'student';
export type SubmissionStatus = 'submitted' | 'grading' | 'graded' | 'failed';

// Auth
export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserResponse {
  id: number;
  username: string;
  role: Role;
  is_registered: boolean;
  real_name: string | null;
  student_id: string | null;
  class_name: string | null;
  email: string | null;
  created_at: string | null;
}

// Admin
export interface CreateUserRequest {
  username: string;
  role?: string;
  real_name?: string | null;
  student_id?: string | null;
  class_name?: string | null;
}

export interface BatchStudentItem {
  username: string;
  real_name: string;
  student_id: string;
  class_name: string;
}

export interface BatchImportResult {
  success_count: number;
  failed: { index: number; username: string; reason: string }[];
  created_ids: number[];
}

export interface SystemStats {
  total_users: number;
  total_documents: number;
  total_assignments: number;
  total_submissions: number;
}

export interface SettingItem {
  id: number;
  key: string;
  value: string;
  category: string;
  updated_at: string | null;
}

// Teacher: Documents
export interface DocumentResponse {
  id: number;
  doc_uuid: string;
  filename: string;
  title: string;
  doc_type: string;
  owner_id: number;
  chunk_count: number;
  parse_status: string;
  uploaded_at: string | null;
}

export interface AdminDocumentItem extends DocumentResponse {
  owner_name: string | null;
}

// Teacher: Assignments
export interface AssignmentSummary {
  id: number;
  title: string;
  is_published: boolean;
  deadline: string | null;
  created_at: string | null;
  submission_count: number;
}

export interface AssignmentResponse {
  id: number;
  teacher_id: number;
  title: string;
  description: string;
  question: string;
  reference_answer: string | null;
  grading_criteria: string;
  deadline: string | null;
  is_published: boolean;
  created_at: string | null;
}

export interface CreateAssignmentRequest {
  title: string;
  description: string;
  question: string;
  reference_answer?: string | null;
  grading_criteria?: {
    dimensions?: { name: string; label: string; weight: number; description: string }[] | null;
    reference_answer?: string | null;
    extra_instructions?: string | null;
  } | null;
  deadline?: string | null;
}

// Student: Assignments
export interface StudentAssignment {
  id: number;
  title: string;
  description: string;
  question: string;
  deadline: string | null;
  teacher_name: string | null;
  has_submitted: boolean;
}

export interface AssignmentDetail {
  id: number;
  title: string;
  description: string;
  question: string;
  reference_answer: string | null;
  grading_criteria: string | null;
  deadline: string | null;
  teacher_name: string | null;
}

// Submissions
export interface SubmissionSummary {
  id: number;
  assignment_id: number;
  assignment_title: string | null;
  student_name: string | null;
  student_real_name: string | null;
  student_id_field: string | null;
  class_name: string | null;
  status: SubmissionStatus;
  submitted_at: string | null;
  total_score: number | null;
  has_attachment: boolean;
  attachment_filename: string | null;
  report_id: number | null;
}

export interface SubmissionDetail {
  id: number;
  assignment_id: number;
  student_name: string | null;
  student_real_name: string | null;
  student_id_field: string | null;
  class_name: string | null;
  content: string;
  has_attachment: boolean;
  attachment_filename: string | null;
  status: string;
  submitted_at: string | null;
}

export interface SubmitResult {
  id: number;
  status: string;
}

// Reports
export interface DimensionScore {
  name: string;
  label: string;
  score: number;
  weight: number;
  weighted_score: number;
  comment: string;
}

export interface ManipulationWarning {
  detected: boolean;
  severity: 'none' | 'low' | 'medium' | 'high';
  fragments: string[];
  comment: string;
}

export interface ReportResponse {
  id: number;
  submission_id: number;
  total_score: number;
  max_score: number;
  dimension_scores: DimensionScore[];
  feedback: string;
  references: string[];
  regulations_found: string[];
  regulations_cited: string[];
  manipulation_warning: ManipulationWarning | null;
  created_at: string | null;
  student_real_name: string | null;
  assignment_title: string | null;
}

// QA
export interface QASource {
  index: number;
  text: string;
  source_name: string | null;
  chunk_index: number | null;
}

export interface QAResponse {
  answer: string;
  sources: QASource[];
}

// Conversations
export interface ConversationSummary {
  id: number;
  title: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface ConversationMessage {
  id: number;
  role: string;
  content: string;
  created_at: string | null;
}

export interface ConversationDetail {
  id: number;
  title: string;
  messages: ConversationMessage[];
  created_at: string | null;
}

// Model Management
export type ModelType = 'chat' | 'embedding' | 'rerank' | 'asr';

export interface ModelProviderResponse {
  id: number;
  name: string;
  provider_type: string;
  api_key: string;
  api_key_full: string;
  base_url: string;
  enabled: boolean;
  created_at: string | null;
  models: ModelConfigResponse[];
}

export interface ModelConfigResponse {
  id: number;
  provider_id: number;
  model_name: string;
  model_type: ModelType;
  enabled: boolean;
  is_default: boolean;
  max_tokens: number;
  created_at: string | null;
}

export interface AvailableProvider {
  provider_type: string;
  name: string;
  default_base_url: string;
  supported_types: string[];
  models: { name: string; type: string; max_tokens: number }[];
}

export interface VerifyResult {
  valid: boolean;
  error: string | null;
  tested: string[];
}
