import client from './client';
import type {
  UserResponse,
  CreateUserRequest,
  BatchStudentItem,
  BatchImportResult,
  SystemStats,
  SettingItem,
} from './types';

export async function getUsers(params?: { role?: string; class_name?: string }): Promise<UserResponse[]> {
  const res = await client.get<UserResponse[]>('/admin/users', { params });
  return res.data;
}

export async function createUser(data: CreateUserRequest): Promise<UserResponse> {
  const res = await client.post<UserResponse>('/admin/users', data);
  return res.data;
}

export async function updateUser(id: number, data: { real_name?: string; class_name?: string; password?: string }): Promise<UserResponse> {
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
