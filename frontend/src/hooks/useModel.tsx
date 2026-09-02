import { createContext, useContext, useState, type ReactNode, useEffect } from 'react';
import { fetchLlmProviderHealth } from '../lib/api';

/** Supported models — must stay in sync with backend MODEL_MAP primary keys */
export const AVAILABLE_MODELS = [
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', badge: 'Ultra Fast',        provider: 'gemini' as const },
  { id: 'gemini-3.1-pro',   label: 'Gemini 3.1 Pro',   badge: 'Coding Expert',     provider: 'gemini' as const },
  { id: 'qwen-3-32b',       label: 'Qwen 3 32B',       badge: 'Coding Pro',        provider: 'groq'   as const },
  { id: 'gpt-oss-120b',     label: 'GPT-OSS 120B',     badge: 'Premium (5/day)',   provider: 'groq'   as const },
  { id: 'nemotron-3-550b',  label: 'Nemotron-3 Ultra', badge: '550B · Reasoning', provider: 'nvidia' as const },
] as const;

export type ModelId = typeof AVAILABLE_MODELS[number]['id'];

export const MODEL_PROVIDER_LABELS: Record<string, string> = {
  groq:   'Groq — Fast & Free',
  gemini: 'Google AI Studio — Free',
  nvidia: 'NVIDIA NIM',
};

/** Maps old localStorage / saved blueprint keys to current model IDs */
export const LEGACY_MODEL_ALIASES: Record<string, ModelId> = {
  'llama-3.1-8b':           'gemini-3.5-flash',
  'llama-3.1-8b-instant':   'gemini-3.5-flash',
  'llama-3.3-70b':          'gemini-3.5-flash',
  'llama-3.3-70b-versatile': 'gemini-3.5-flash',
  'llama3-70b-8192':        'gemini-3.5-flash',
  'llama3-8b-8192':         'gemini-3.5-flash',
  'gemini-2.5-flash':       'gemini-3.5-flash',
  'gemini-2.5-pro':         'gemini-3.1-pro',
  'gemini-3.0-flash':       'gemini-3.5-flash',
  'gemini-3.0-pro':         'gemini-3.1-pro',
  'gemini-3-flash-preview': 'gemini-3.5-flash',
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
  return (AVAILABLE_MODELS.find((m) => m.id === resolved)?.id as ModelId) || 'gemini-3.5-flash';
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
    if (!providerHealth) return true;
    return providerHealth[model.provider]?.configured ?? false;
  };

  // If selected model's provider is not configured, fall back to first configured model
  useEffect(() => {
    if (!providerHealth) return;
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
