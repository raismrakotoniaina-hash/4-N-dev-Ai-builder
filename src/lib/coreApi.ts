import type { BuilderResult, Project, ProjectFile, Deployment } from '../types/app';

const BASE_URL = (import.meta.env.VITE_CORE_API_URL || 'https://fourn-dev-core.onrender.com').replace(/\/$/, '');
const KEY_STORAGE = '4ndev_builder_api_key';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const key = localStorage.getItem(KEY_STORAGE);
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (key) headers.set('Authorization', `Bearer ${key}`);
  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || data?.message || `Core API error ${response.status}`);
  return data as T;
}

export const coreApi = {
  setApiKey(key: string) { localStorage.setItem(KEY_STORAGE, key.trim()); },
  getApiKey() { return localStorage.getItem(KEY_STORAGE) || ''; },
  clearApiKey() { localStorage.removeItem(KEY_STORAGE); },
  health: () => request<{ success: boolean; status: string }>('/health'),
  listProjects: () => request<{ projects: Project[] }>('/v1/projects'),
  createProject: (name: string, description = '') => request<{ project: Project }>('/v1/projects', { method: 'POST', body: JSON.stringify({ name, description }) }),
  listFiles: (projectId: string) => request<{ files: ProjectFile[] }>(`/v1/projects/${projectId}/files`),
  saveFile: (projectId: string, path: string, content: string) => request('/v1/files', { method: 'POST', body: JSON.stringify({ projectId, path, content }) }),
  plan: (prompt: string) => request<BuilderResult>('/v1/builder/plan', { method: 'POST', body: JSON.stringify({ prompt }) }),
  generate: (payload: Record<string, unknown>) => request<BuilderResult>('/v1/builder', { method: 'POST', body: JSON.stringify(payload) }),
  review: (payload: Record<string, unknown>) => request<BuilderResult>('/v1/builder/review', { method: 'POST', body: JSON.stringify(payload) }),
  build: (projectId: string) => request<BuilderResult>('/v1/builds', { method: 'POST', body: JSON.stringify({ projectId }) }),
  listDeployments: (projectId?: string) => request<{ deployments: Deployment[] }>(projectId ? `/v1/deployments?projectId=${projectId}` : '/v1/deployments'),
  deploy: (projectId: string) => request<BuilderResult>('/v1/deployments', { method: 'POST', body: JSON.stringify({ projectId }) }),
};
