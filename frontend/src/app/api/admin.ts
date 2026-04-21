import client from './client';
import type {
  UserResponse,
  CreateUserRequest,
  BatchStudentItem,
  BatchImportResult,
  SystemStats,
  SettingItem,
  AdminDocumentItem,
  AssignmentSummary,
  SubmissionSummary,
  SubmissionDetail,
  ReportResponse,
  StudentProfileResponse,
  StudentListItem,
  ScoreDistributionResponse,
} from './types';

export async function getUsers(params?: { role?: string; class_name?: string; grade?: string }): Promise<UserResponse[]> {
  const res = await client.get<UserResponse[]>('/admin/users', { params });
  return res.data;
}

export async function createUser(data: CreateUserRequest): Promise<UserResponse> {
  const res = await client.post<UserResponse>('/admin/users', data);
  return res.data;
}

export async function updateUser(id: number, data: { real_name?: string; class_name?: string; grade?: string; password?: string }): Promise<UserResponse> {
  const res = await client.put<UserResponse>(`/admin/users/${id}`, data);
  return res.data;
}

export async function deleteUser(id: number): Promise<void> {
  await client.delete(`/admin/users/${id}`);
}

export async function batchImportStudents(students: BatchStudentItem[]): Promise<BatchImportResult> {
  const res = await client.post<BatchImportResult>('/admin/users/batch', { students });
  return res.data;
}

export async function getStats(): Promise<SystemStats> {
  const res = await client.get<SystemStats>('/admin/stats');
  return res.data;
}

export async function getSettings(): Promise<Record<string, SettingItem[]>> {
  const res = await client.get<Record<string, SettingItem[]>>('/admin/settings');
  return res.data;
}

export async function updateSetting(key: string, value: string): Promise<SettingItem> {
  const res = await client.put<SettingItem>(`/admin/settings/${key}`, { value });
  return res.data;
}

// Data browsing
export async function getAdminDocuments(): Promise<AdminDocumentItem[]> {
  const res = await client.get<AdminDocumentItem[]>('/admin/knowledge');
  return res.data;
}

export async function getAdminChunks(docId: number): Promise<{chunks: {index: number; text: string; source: string}[]}> {
  const res = await client.get(`/admin/knowledge/${docId}/chunks`);
  return res.data;
}

export async function getAdminAssignments(): Promise<AssignmentSummary[]> {
  const res = await client.get<AssignmentSummary[]>('/admin/assignments');
  return res.data;
}

export async function getAdminSubmissions(assignmentId: number): Promise<SubmissionSummary[]> {
  const res = await client.get<SubmissionSummary[]>(`/admin/assignments/${assignmentId}/submissions`);
  return res.data;
}

export async function getAdminSubmissionDetail(submissionId: number): Promise<SubmissionDetail> {
  const res = await client.get<SubmissionDetail>(`/admin/submissions/${submissionId}`);
  return res.data;
}

export async function getAdminReport(reportId: number): Promise<ReportResponse> {
  const res = await client.get<ReportResponse>(`/admin/reports/${reportId}`);
  return res.data;
}

export async function getAdminStudents(): Promise<StudentListItem[]> {
  const res = await client.get<StudentListItem[]>('/admin/students');
  return res.data;
}

export async function getAdminStudentProfile(studentId: number): Promise<StudentProfileResponse> {
  const res = await client.get<StudentProfileResponse>(`/admin/students/${studentId}/profile`);
  return res.data;
}

export async function getScoreDistribution(params?: { assignment_id?: number; grade?: string }): Promise<ScoreDistributionResponse> {
  const res = await client.get<ScoreDistributionResponse>('/admin/stats/score-distribution', { params });
  return res.data;
}
