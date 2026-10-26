import type { BuilderModel, Project } from '../types/app';

const BASE_URL = (import.meta.env.VITE_BUILDER_API_URL || '').replace(/\/$/, '');

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!BASE_URL) throw new Error('Builder backend URL is not configured (VITE_BUILDER_API_URL).');
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success !== true) {
    throw new Error(payload?.error || `Builder backend error ${response.status}`);
  }
  return payload as T;
}

export interface BuilderUser { id: string; email: string; createdAt: string; }
export interface CoreConnection { connected: boolean; connectedAt: string | null; }
export interface GeneratedFile { path: string; content: string; }
export interface GenerationResult { project: Project & { files?: GeneratedFile[] }; generatedFiles: GeneratedFile[]; modelsUsed: string[]; usage?: { charged_usd?: number; currency?: string; input_tokens?: number; output_tokens?: number }; }

export const builderApi = {
  listModels(): Promise<BuilderModel[]> {
    return request<{ success: true; models: BuilderModel[] }>('/api/models').then((result) => result.models);
  },
  me(): Promise<BuilderUser> {
    return request<{ success: true; user: BuilderUser }>('/api/auth/me').then((result) => result.user);
  },
  register(email: string, password: string): Promise<BuilderUser> {
    return request<{ success: true; user: BuilderUser }>('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }).then((result) => result.user);
  },
  login(email: string, password: string): Promise<BuilderUser> {
    return request<{ success: true; user: BuilderUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }).then((result) => result.user);
  },
  logout(): Promise<void> {
    return request('/api/auth/logout', { method: 'POST' }).then(() => undefined);
  },
  listProjects(): Promise<Project[]> {
    return request<{ success: true; projects: Project[] }>('/api/projects').then((result) => result.projects);
  },
  createProject(name: string, description: string): Promise<Project> {
    return request<{ success: true; project: Project }>('/api/projects', { method: 'POST', body: JSON.stringify({ name, description }) }).then((result) => result.project);
  },
  getProject(id: string): Promise<Project & { files?: GeneratedFile[] }> {
    return request<{ success: true; project: Project & { files?: GeneratedFile[] } }>(`/api/projects/${id}`).then((result) => result.project);
  },
  generateFreePrototype(id: string, prompt: string): Promise<GenerationResult & { mode: 'free-template'; coreCalls: 0; template: string }> {\n    return request<GenerationResult & { mode: 'free-template'; coreCalls: 0; template: string }>(`/api/projects/${id}/prototype`, { method: 'POST', body: JSON.stringify({ prompt }) });\n  },\n  generateProject(id: string, prompt: string): Promise<GenerationResult> {
    return request<GenerationResult & { success: true }>(`/api/projects/${id}/generate`, { method: 'POST', body: JSON.stringify({ prompt }) });
  },
  connectCore(apiKey: string): Promise<void> {
    return request('/api/core/connect', { method: 'POST', body: JSON.stringify({ apiKey }) }).then(() => undefined);
  },
  coreConnection(): Promise<CoreConnection> {
    return request<CoreConnection & { success: true }>('/api/core/connection');
  },
  disconnectCore(): Promise<void> {
    return request('/api/core/connection', { method: 'DELETE' }).then(() => undefined);
  },
  coreCredits(): Promise<unknown> {
    return request<{ success: true; credits: unknown }>('/api/core/credits').then((result) => result.credits);
  }
};
