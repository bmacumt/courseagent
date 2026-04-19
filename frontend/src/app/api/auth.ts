import client from './client';
import type { TokenResponse, UserResponse } from './types';

export async function login(username: string, password: string): Promise<TokenResponse> {
  const res = await client.post<TokenResponse>('/login', { username, password });
  return res.data;
}

export async function register(username: string, email: string, code: string, password: string): Promise<TokenResponse> {
  const res = await client.post<TokenResponse>('/register', { username, email, code, password });
  return res.data;
}

export async function sendCode(email: string, purpose: 'register' | 'reset_password' | 'change_email'): Promise<{ message: string }> {
  const res = await client.post('/auth/send-code', { email, purpose });
  return res.data;
}

export async function resetPassword(email: string, code: string, newPassword: string): Promise<{ message: string }> {
  const res = await client.post('/auth/reset-password', { email, code, new_password: newPassword });
  return res.data;
}

export async function getProfile(): Promise<UserResponse> {
  const res = await client.get<UserResponse>('/auth/profile');
  return res.data;
}

export async function changeEmail(newEmail: string, code: string): Promise<UserResponse> {
  const res = await client.post<UserResponse>('/auth/change-email', { new_email: newEmail, code });
  return res.data;
}

export async function getMe(): Promise<UserResponse> {
  const res = await client.get<UserResponse>('/me');
  return res.data;
}
