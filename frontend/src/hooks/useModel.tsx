import { createContext, useContext, useState, type ReactNode, useEffect } from 'react';
import { fetchLlmProviderHealth } from '../lib/api';

/** Supported models — must stay in sync with backend MODEL_MAP primary keys */
export const AVAILABLE_MODELS = [
  { id: 'pipeline', label: 'Auto', badge: 'Task-based routing', provider: 'auto' as const },
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', badge: 'Free · Recommended', provider: 'gemini' as const },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', badge: 'Free · Fallback', provider: 'gemini' as const },
  { id: 'gpt-oss-120b',     label: 'GPT-OSS 120B',     badge: 'Free · 5/day', provider: 'groq' as const },
] as const;

export type ModelId = typeof AVAILABLE_MODELS[number]['id'];

export const MODEL_PROVIDER_LABELS: Record<string, string> = {
  gemini:     'Google AI Studio — Free tier',
  nvidia:     'NVIDIA NIM — Prototyping',
  openrouter: 'OpenRouter',
  groq:       'Groq — Fast & Free',
};

/** Maps old localStorage / saved blueprint keys to current model IDs */
export const LEGACY_MODEL_ALIASES: Record<string, ModelId> = {
  'kimi-k2.6':             'pipeline',
  'moonshotai/kimi-k2.6':  'pipeline',
  'kimi-k3':               'pipeline',
  'glm-5.2':               'pipeline',
  'glm-5.3':               'pipeline',
  'nemotron-3-550b':      'pipeline',
  'llama-3.1-8b':          'gemini-3.5-flash',
  'llama-3.1-8b-instant':  'gemini-3.5-flash',
  'llama-3.3-70b':         'gemini-3.5-flash',
  'llama-3.3-70b-versatile':'gemini-3.5-flash',
  'llama3-70b-8192':       'gemini-3.5-flash',
  'llama3-8b-8192':        'gemini-3.5-flash',
  'gemini-2.5-flash':      'gemini-3.5-flash',
  'gemini-2.5-pro':        'pipeline',
  'gemini-3.0-flash':      'gemini-3.5-flash',
  'gemini-3.0-pro':        'pipeline',
  'gemini-3-flash-preview':'gemini-3.5-flash',
};

interface ModelContextType {
  selectedModel: ModelId;
  setSelectedModel: (model: ModelId) => void;
  providerHealth: Record<string, { configured: boolean; label: string }> | null;
  isModelConfigured: (modelId: ModelId) => boolean;
}

const ModelContext = createContext<ModelContextType | undefined>(undefined);

function resolveModelId(saved: string | null): ModelId {
  const resolved = LEGACY_MODEL_ALIASES[saved ?? ''] ?? saved;
  return (AVAILABLE_MODELS.find((m) => m.id === resolved)?.id as ModelId) || 'pipeline';
}

export function ModelProvider({ children }: { children: ReactNode }) {
  const [selectedModel, setSelectedModel] = useState<ModelId>(() =>
    resolveModelId(localStorage.getItem('buildx_selected_model'))
  );
  const [providerHealth, setProviderHealth] = useState<Record<string, { configured: boolean; label: string }> | null>(null);

  useEffect(() => {
    localStorage.setItem('buildx_selected_model', selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    fetchLlmProviderHealth()
      .then((health) => setProviderHealth(health.providers))
      .catch(() => setProviderHealth(null));
  }, []);

  const isModelConfigured = (modelId: ModelId): boolean => {
    const model = AVAILABLE_MODELS.find((m) => m.id === modelId);
    if (!model) return false;
    if (model.provider === 'auto') return providerHealth?.gemini?.configured ?? false;
    if (!providerHealth) return false;
    return providerHealth[model.provider]?.configured ?? false;
  };

  // If selected model's provider is not configured, fall back to first configured model
  useEffect(() => {
    if (!providerHealth || selectedModel === 'pipeline') return;
    const current = AVAILABLE_MODELS.find((m) => m.id === selectedModel);
    if (current && providerHealth[current.provider]?.configured) return;
    const fallback = AVAILABLE_MODELS.find((m) => providerHealth[m.provider]?.configured);
    if (fallback && fallback.id !== selectedModel) {
      setSelectedModel(fallback.id);
    }
  }, [providerHealth, selectedModel]);

  return (
    <ModelContext.Provider value={{ selectedModel, setSelectedModel, providerHealth, isModelConfigured }}>
      {children}
    </ModelContext.Provider>
  );
}

export function useModel() {
  const context = useContext(ModelContext);
  if (!context) {
    throw new Error('useModel must be used within a ModelProvider');
  }
  return context;
}
