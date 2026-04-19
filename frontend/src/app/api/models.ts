import client from './client';
import type { ModelProviderResponse, AvailableProvider, ModelConfigResponse, VerifyResult, ModelType } from './types';

export async function getAvailableProviders(): Promise<AvailableProvider[]> {
  const res = await client.get<AvailableProvider[]>('/admin/models/available-providers');
  return res.data;
}

export async function getProviders(): Promise<ModelProviderResponse[]> {
  const res = await client.get<ModelProviderResponse[]>('/admin/models/providers');
  return res.data;
}

export async function addProvider(data: { provider_type: string; api_key: string; base_url?: string }): Promise<{ id: number; name: string }> {
  const res = await client.post('/admin/models/providers', data);
  return res.data;
}

export async function updateProvider(id: number, data: { api_key?: string; base_url?: string; enabled?: boolean }): Promise<void> {
  await client.put(`/admin/models/providers/${id}`, data);
}

export async function deleteProvider(id: number): Promise<void> {
  await client.delete(`/admin/models/providers/${id}`);
}

export async function verifyProvider(id: number): Promise<VerifyResult> {
  const res = await client.post<VerifyResult>(`/admin/models/providers/${id}/verify`);
  return res.data;
}

export async function addModel(providerId: number, data: { model_name: string; model_type: string; max_tokens?: number; is_default?: boolean }): Promise<{ id: number }> {
  const res = await client.post(`/admin/models/providers/${providerId}/models`, data);
  return res.data;
}

export async function deleteModel(providerId: number, modelId: number): Promise<void> {
  await client.delete(`/admin/models/providers/${providerId}/models/${modelId}`);
}

export async function toggleModel(modelId: number): Promise<{ enabled: boolean }> {
  const res = await client.put(`/admin/models/configs/${modelId}/toggle`);
  return res.data;
}

export async function setDefaultModel(data: { model_type: string; model_id: number }): Promise<void> {
  await client.put('/admin/models/defaults', data);
}
