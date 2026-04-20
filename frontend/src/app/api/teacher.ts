import client from './client';
import type {
  DocumentResponse,
  AssignmentSummary,
  AssignmentResponse,
  CreateAssignmentRequest,
  SubmissionSummary,
  SubmissionDetail,
  ReportResponse,
} from './types';

// Knowledge
export async function getDocuments(): Promise<DocumentResponse[]> {
  const res = await client.get<DocumentResponse[]>('/teacher/knowledge');
  return res.data;
}

export async function uploadDocument(title: string, file: File, docType = 'book'): Promise<DocumentResponse> {
  const form = new FormData();
  form.append('title', title);
  form.append('doc_type', docType);
  form.append('file', file);
  const res = await client.post<DocumentResponse>('/teacher/knowledge', form);
  return res.data;
}

export async function parseDocument(id: number): Promise<{ status: string; doc_id: number }> {
  const res = await client.post<{ status: string; doc_id: number }>(`/teacher/knowledge/${id}/parse`);
  return res.data;
}

export async function deleteDocument(id: number): Promise<void> {
  await client.delete(`/teacher/knowledge/${id}`);
}

export async function getDocumentChunks(id: number): Promise<{chunks: {index: number; text: string; source: string}[]}> {
  const res = await client.get(`/teacher/knowledge/${id}/chunks`);
  return res.data;
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

export async function getSubmissionDetail(submissionId: number): Promise<SubmissionDetail> {
  const res = await client.get<SubmissionDetail>(`/teacher/submissions/${submissionId}`);
  return res.data;
}

export async function exportCsv(assignmentId: number, filename?: string): Promise<void> {
  const token = localStorage.getItem('tunnel_auth_token');
  const resp = await fetch(`${client.defaults.baseURL}/teacher/assignments/${assignmentId}/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) { throw new Error('导出失败'); }
  const blob = await resp.blob();
  const disposition = resp.headers.get('content-disposition');
  const name = filename || parseFilename(disposition);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

// Reports
export async function getReport(reportId: number): Promise<ReportResponse> {
  const res = await client.get<ReportResponse>(`/teacher/reports/${reportId}`);
  return res.data;
}

// Attachment download
export async function fetchAttachmentBlob(submissionId: number): Promise<{ blob: Blob; filename: string }> {
  const token = localStorage.getItem('tunnel_auth_token');
  const resp = await fetch(`${client.defaults.baseURL}/teacher/submissions/${submissionId}/attachment`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) { throw new Error('下载失败'); }
  const blob = await resp.blob();
  const disposition = resp.headers.get('content-disposition');
  const filename = parseFilename(disposition);
  return { blob, filename };
}

export async function downloadAttachment(submissionId: number): Promise<void> {
  const { blob, filename } = await fetchAttachmentBlob(submissionId);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function parseFilename(disposition: string | null): string {
  if (!disposition) return 'attachment';
  const utf8 = disposition.match(/filename\*=UTF-8''(.+?)(?:;|$)/i);
  if (utf8) return decodeURIComponent(utf8[1]);
  const ascii = disposition.match(/filename="?(.+?)"?(?:;|$)/i);
  if (ascii) return ascii[1].replace(/^"|"$/g, '');
  return 'attachment';
}
