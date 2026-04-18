import client from './client';
import type { TokenResponse, UserResponse } from './types';

export async function login(username: string, password: string): Promise<TokenResponse> {
  const res = await client.post<TokenResponse>('/login', { username, password });
  return res.data;
}

export async function getMe(): Promise<UserResponse> {
  const res = await client.get<UserResponse>('/me');
  return res.data;
}
