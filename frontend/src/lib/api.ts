import axios, { AxiosError } from 'axios';
import type { Blueprint, SavedBlueprint, ApiResponse, ApiError } from './types';

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
    if (data?.error) return data.error;
    if (err.code === 'ECONNABORTED') return 'Request timed out. The AI took too long. Please try again.';
    if (!err.response) return 'Cannot reach the server. Make sure the backend is running.';
    if (err.response.status === 429) return 'Rate limit hit. Please wait a moment before generating another blueprint.';
    if (err.response.status === 500) return 'Server error. Please try again.';
  }
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred.';
}

// ─── Auth token helper ────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('buildx_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// ─── Non-streaming generation (fallback) ──────────────────

export async function generateBlueprint(idea: string): Promise<{ blueprint: Blueprint; id: string }> {
  try {
    const response = await apiClient.post<ApiResponse<Blueprint> & { id: string }>(
      '/api/blueprint/generate',
      { idea },
      { headers: getAuthHeaders() }
    );
    return { blueprint: response.data.data, id: response.data.id };
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

// ─── Streaming generation (SSE via fetch) ─────────────────

export interface SSEEvent {
  event: string;
  data: unknown;
}

export async function* generateBlueprintStream(idea: string): AsyncGenerator<SSEEvent> {
  const url = `${BASE_URL}/api/blueprint/generate-stream`;

  const response = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ idea }),
  });

  if (!response.ok) {
    let errorMsg = 'Server error';
    try {
      const errorData = await response.json();
      errorMsg = errorData.error || errorMsg;
    } catch {
      // ignore parse error
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
        // Empty line = end of SSE event
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

// ─── Fetch saved blueprint ────────────────────────────────

export async function fetchBlueprint(id: string): Promise<SavedBlueprint> {
  try {
    const response = await apiClient.get<ApiResponse<SavedBlueprint>>(
      `/api/blueprint/${id}`
    );
    return response.data.data;
  } catch (err) {
    if (err instanceof AxiosError && err.response?.status === 404) {
      throw new Error('Blueprint not found. It may have been deleted or the link is invalid.');
    }
    throw new Error(extractErrorMessage(err));
  }
}

// ─── Health check ─────────────────────────────────────────

export async function checkHealth(): Promise<boolean> {
  try {
    await apiClient.get('/health', { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}
