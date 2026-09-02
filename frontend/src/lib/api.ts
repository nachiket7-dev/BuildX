import axios, { AxiosError } from 'axios';
import type {
  Blueprint,
  SavedBlueprint,
  BlueprintListItem,
  ApiResponse,
  ApiError,
  StackSpec,
} from './types';

// In dev, Vite proxies /api → localhost:3001
// In prod, set VITE_API_URL to your deployed backend URL
const BASE_URL = import.meta.env.VITE_API_URL ?? '';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 120_000, // 2 minutes — AI generation can be slow
  headers: {
    'Content-Type': 'application/json',
  },
});

function extractErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as ApiError | undefined;
    if (data?.error) {
      if (data.details?.length) {
        const detailText = data.details.map((d) => d.message).join(' ');
        return `${data.error}: ${detailText}`;
      }
      return data.error;
    }
    if (err.code === 'ECONNABORTED') return 'Request timed out. The AI took too long. Please try again.';
    if (!err.response) return 'Cannot reach the server. Make sure the backend is running.';
    if (err.response.status === 429) return 'Rate limit hit. Please wait a moment before generating another blueprint.';
    if (err.response.status === 400) return data?.error ?? 'Invalid request. Please try again.';
    if (err.response.status === 502) return data?.error ?? 'AI returned an invalid response. Please try again.';
    if (err.response.status === 500) return data?.error ?? 'Server error. Please try again.';
  }
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred.';
}

// ─── Auth token helper ────────────────────────────────────

export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('buildx_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('buildx_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Streaming generation (SSE via fetch) ─────────────────

export interface SSEEvent {
  event: string;
  data: unknown;
}

async function* readSSEStream(
  response: Response,
  signal?: AbortSignal
): AsyncGenerator<SSEEvent> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Streaming not supported by browser');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    if (signal?.aborted) break;
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let currentEvent = '';
    let currentData = '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        currentData = line.slice(6);
      } else if (line === '' && currentEvent && currentData) {
        try {
          yield { event: currentEvent, data: JSON.parse(currentData) };
        } catch {
          yield { event: currentEvent, data: currentData };
        }
        currentEvent = '';
        currentData = '';
      } else if (line.startsWith(':')) {
        // SSE comment
      }
    }
  }
}

export async function* generateBlueprintStream(
  idea: string,
  model: string,
  stack?: StackSpec,
  signal?: AbortSignal
): AsyncGenerator<SSEEvent> {
  const url = `${BASE_URL}/api/blueprint/generate-stream`;

  const response = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ idea, model, stack }),
    signal,
  });

  if (!response.ok) {
    let errorMsg = 'Server error';
    try {
      const errorData = await response.json();
      errorMsg = errorData.error || errorMsg;
    } catch {
      // ignore parse error
    }
    if (response.status === 401) {
      throw new Error('Please sign in to generate blueprints.');
    }
    throw new Error(errorMsg);
  }

  yield* readSSEStream(response, signal);
}

export async function* regenerateBlueprintStream(
  blueprintId: string,
  model: string,
  signal?: AbortSignal
): AsyncGenerator<SSEEvent> {
  const url = `${BASE_URL}/api/blueprint/regenerate-stream`;

  const response = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ id: blueprintId, model }),
    signal,
  });

  if (!response.ok) {
    let errorMsg = 'Regeneration failed';
    try {
      const errorData = await response.json();
      errorMsg = errorData.error || errorMsg;
    } catch {
      // ignore parse error
    }
    if (response.status === 401) {
      throw new Error('Please sign in to regenerate blueprints.');
    }
    throw new Error(errorMsg);
  }

  yield* readSSEStream(response, signal);
}

// ─── Fetch saved blueprint ────────────────────────────────

export async function fetchBlueprint(id: string): Promise<SavedBlueprint> {
  try {
    const response = await apiClient.get<ApiResponse<SavedBlueprint>>(`/api/blueprint/${id}`, {
      headers: getAuthHeaders(),
    });
    return response.data.data;
  } catch (err) {
    if (err instanceof AxiosError && err.response?.status === 401) {
      throw new Error('Please sign in to view this blueprint.');
    }
    if (err instanceof AxiosError && err.response?.status === 404) {
      throw new Error('Blueprint not found. It may have been deleted or the link is invalid.');
    }
    throw new Error(extractErrorMessage(err));
  }
}

// ─── Blueprint lists ──────────────────────────────────────

export async function fetchPublicBlueprints(): Promise<BlueprintListItem[]> {
  const response = await apiClient.get<ApiResponse<BlueprintListItem[]>>('/api/blueprint/list', {
    headers: getAuthHeaders(),
  });
  return response.data.data;
}

export async function fetchMyBlueprints(): Promise<BlueprintListItem[]> {
  const response = await apiClient.get<ApiResponse<BlueprintListItem[]>>('/api/auth/my-blueprints', {
    headers: getAuthHeaders(),
  });
  return response.data.data;
}

export async function setBlueprintVisibility(
  blueprintId: string,
  isPublic: boolean
): Promise<void> {
  await apiClient.patch(
    `/api/blueprint/${blueprintId}/visibility`,
    { is_public: isPublic },
    { headers: getAuthHeaders() }
  );
}

export async function deleteBlueprint(blueprintId: string): Promise<void> {
  await apiClient.delete(`/api/auth/blueprint/${blueprintId}`, {
    headers: getAuthHeaders(),
  });
}

export async function refineBlueprint(
  blueprint: Blueprint,
  message: string,
  model?: string,
  blueprintId?: string | null
): Promise<Blueprint> {
  try {
    const response = await apiClient.post<ApiResponse<Blueprint>>(
      '/api/blueprint/refine',
      { blueprint, message, model, id: blueprintId ?? undefined },
      { headers: getAuthHeaders() }
    );
    return response.data.data;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

/**
 * Refine a saved blueprint by ID — the server loads the spec from DB, so no
 * need to send the full blueprint object. Uses POST /api/blueprint/:id/refine.
 */
export async function refineByIdBlueprint(
  blueprintId: string,
  prompt: string,
  model?: string
): Promise<Blueprint> {
  try {
    const response = await apiClient.post<{ success: boolean; blueprint: Blueprint }>(
      `/api/blueprint/${blueprintId}/refine`,
      { prompt, model },
      { headers: getAuthHeaders() }
    );
    return response.data.blueprint;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

/**
 * Export blueprint scaffold to GitHub repository via backend API
 */
export async function exportBlueprintToGithub(
  blueprint: Blueprint,
  blueprintId?: string
): Promise<{ success: boolean; repoUrl: string; message: string }> {
  try {
    const response = await apiClient.post<{
      success: boolean;
      repoUrl: string;
      message: string;
    }>(
      '/api/blueprint/export-github',
      { blueprint, id: blueprintId },
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (err) {
    if (err instanceof AxiosError && err.response?.data) {
      const data = err.response.data as { error?: string; require_github_auth?: boolean };
      if (data.require_github_auth) {
        const error: any = new Error(data.error || 'GitHub authentication required');
        error.require_github_auth = true;
        throw error;
      }
    }
    throw new Error(extractErrorMessage(err));
  }
}

/**
 * Trigger backend zip scaffold generation and trigger browser download
 */
export async function downloadBlueprintZip(blueprintId?: string, blueprint?: Blueprint): Promise<void> {
  const url = blueprintId
    ? `${BASE_URL}/api/blueprint/export?id=${encodeURIComponent(blueprintId)}`
    : `${BASE_URL}/api/blueprint/export`;

  const headers = getAuthHeaders();
  const options: RequestInit = {
    method: 'POST',
    headers,
  };

  if (!blueprintId && blueprint) {
    options.body = JSON.stringify(blueprint);
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    let errorMsg = 'Failed to generate ZIP download';
    try {
      const data = await response.json();
      errorMsg = data.error || errorMsg;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `${(blueprint?.appName ?? 'buildx-scaffold').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

export interface LlmProviderHealth {
  service: string;
  ready: boolean;
  providers: Record<string, { configured: boolean; label: string }>;
  message?: string;
}

export async function fetchLlmProviderHealth(): Promise<LlmProviderHealth> {
  const response = await apiClient.get<LlmProviderHealth>('/api/blueprint/health', { timeout: 5000 });
  return response.data;
}

// ─── Code Generation & Files API ──────────────────────────

export interface VirtualFileFull {
  path: string;
  language: string;
  content: string;
}

/** Fetches all generated files with contents in a single request */
export async function fetchBlueprintFilesWithContent(blueprintId: string): Promise<VirtualFileFull[]> {
  const response = await apiClient.get<ApiResponse<{ files: VirtualFileFull[] }>>(
    `/api/blueprint/${blueprintId}/files/contents`,
    { headers: getAuthHeaders() }
  );
  return response.data.data.files;
}

/** Saves or updates content for a single virtual file */
export async function saveBlueprintFile(
  blueprintId: string,
  path: string,
  content: string,
  language: string
): Promise<void> {
  await apiClient.put(
    `/api/blueprints/${blueprintId}/vfs/file`,
    { path, content, language },
    { headers: getAuthHeaders() }
  );
}

/** Streams code generation SSE events */
export async function* generateCodeStream(
  blueprintId: string,
  model?: string,
  signal?: AbortSignal
): AsyncGenerator<SSEEvent> {
  const url = `${BASE_URL}/api/blueprint/${blueprintId}/codegen`;

  const response = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(model ? { model } : {}),
    signal,
  });

  if (!response.ok) {
    let errorMsg = 'Server error';
    try {
      const errorData = await response.json();
      errorMsg = errorData.error || errorMsg;
    } catch {
      // ignore parse error
    }
    if (response.status === 401) {
      throw new Error('Please sign in to generate code.');
    }
    throw new Error(errorMsg);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Streaming not supported by browser');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE events from the buffer
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep the incomplete last line

    let currentEvent = '';
    let currentData = '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        currentData = line.slice(6);
      } else if (line === '' && currentEvent && currentData) {
        try {
          yield { event: currentEvent, data: JSON.parse(currentData) };
        } catch {
          yield { event: currentEvent, data: currentData };
        }
        currentEvent = '';
        currentData = '';
      } else if (line.startsWith(':')) {
        // SSE comment, skip
      }
    }
  }
}

// ─── Live Preview API ──────────────────────────────────────

/** Creates a short-lived signed preview URL for a private blueprint. */
export async function createBlueprintPreviewLink(blueprintId: string): Promise<string> {
  const response = await apiClient.post<ApiResponse<{ path: string }>>(
    `/api/blueprint/${blueprintId}/preview/link`,
    {},
    { headers: getAuthHeaders() }
  );
  const base = import.meta.env.VITE_API_URL ?? '';
  return `${base}${response.data.data.path}`;
}
