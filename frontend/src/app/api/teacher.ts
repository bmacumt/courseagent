import client from './client';
import type {
  DocumentResponse,
  AssignmentSummary,
  AssignmentResponse,
  CreateAssignmentRequest,
  SubmissionSummary,
  ReportResponse,
} from './types';

// Knowledge
export async function getDocuments(): Promise<DocumentResponse[]> {
  const res = await client.get<DocumentResponse[]>('/teacher/knowledge');
  return res.data;
}

export async function uploadDocument(title: string, file: File, docType = 'specification'): Promise<DocumentResponse> {
  const form = new FormData();
  form.append('title', title);
  form.append('doc_type', docType);
  form.append('file', file);
  const res = await client.post<DocumentResponse>('/teacher/knowledge', form);
  return res.data;
}

export async function deleteDocument(id: number): Promise<void> {
  await client.delete(`/teacher/knowledge/${id}`);
}

// Assignments
export async function getAssignments(): Promise<AssignmentSummary[]> {
  const res = await client.get<AssignmentSummary[]>('/teacher/assignments');
  return res.data;
}

export async function createAssignment(data: CreateAssignmentRequest): Promise<AssignmentResponse> {
  const res = await client.post<AssignmentResponse>('/teacher/assignments', data);
  return res.data;
}

export async function updateAssignment(id: number, data: Partial<CreateAssignmentRequest>): Promise<AssignmentResponse> {
  const res = await client.put<AssignmentResponse>(`/teacher/assignments/${id}`, data);
  return res.data;
}

export async function publishAssignment(id: number): Promise<AssignmentResponse> {
  const res = await client.put<AssignmentResponse>(`/teacher/assignments/${id}/publish`);
  return res.data;
}

export async function deleteAssignment(id: number): Promise<void> {
  await client.delete(`/teacher/assignments/${id}`);
}

// Submissions
export async function getSubmissions(assignmentId: number): Promise<SubmissionSummary[]> {
  const res = await client.get<SubmissionSummary[]>(`/teacher/assignments/${assignmentId}/submissions`);
  return res.data;
}

export function getExportCsvUrl(assignmentId: number): string {
  return `${client.defaults.baseURL}/teacher/assignments/${assignmentId}/export`;
}

// Reports
export async function getReport(reportId: number): Promise<ReportResponse> {
  const res = await client.get<ReportResponse>(`/teacher/reports/${reportId}`);
  return res.data;
}
