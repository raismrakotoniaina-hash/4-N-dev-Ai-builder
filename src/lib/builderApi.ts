import type { BuilderModel } from '../types/app';

const BASE_URL = (import.meta.env.VITE_BUILDER_API_URL || '').replace(/\/$/, '');

export const builderApi = {
  async listModels(): Promise<BuilderModel[]> {
    if (!BASE_URL) {
      throw new Error('Builder backend URL is not configured (VITE_BUILDER_API_URL).');
    }

    const response = await fetch(`${BASE_URL}/api/models`, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload?.success !== true || !Array.isArray(payload.models)) {
      throw new Error(payload?.error || `Builder backend error ${response.status}`);
    }

    return payload.models as BuilderModel[];
  }
};
