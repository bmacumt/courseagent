import client from './client';
import type {
  StudentAssignment,
  AssignmentDetail,
  SubmissionSummary,
  SubmitResult,
  ReportResponse,
  QAResponse,
} from './types';

// Assignments
export async function getStudentAssignments(): Promise<StudentAssignment[]> {
  const res = await client.get<StudentAssignment[]>('/student/assignments');
  return res.data;
}

export async function getStudentAssignment(id: number): Promise<AssignmentDetail> {
  const res = await client.get<AssignmentDetail>(`/student/assignments/${id}`);
  return res.data;
}

// Submit
export async function submitAnswer(assignmentId: number, content?: string, file?: File): Promise<SubmitResult> {
  const form = new FormData();
  if (content) form.append('content', content);
  if (file) form.append('file', file);
  const res = await client.post<SubmitResult>(`/student/assignments/${assignmentId}/submit`, form);
  return res.data;
}

// Submissions
export async function getStudentSubmissions(): Promise<SubmissionSummary[]> {
  const res = await client.get<SubmissionSummary[]>('/student/submissions');
  return res.data;
}

export function getAttachmentUrl(submissionId: number): string {
  return `${client.defaults.baseURL}/student/submissions/${submissionId}/attachment`;
}

// Reports
export async function getStudentReport(reportId: number): Promise<ReportResponse> {
  const res = await client.get<ReportResponse>(`/student/reports/${reportId}`);
  return res.data;
}

// QA
export async function askQuestion(question: string): Promise<QAResponse> {
  const res = await client.post<QAResponse>('/student/qa', { question });
  return res.data;
}
