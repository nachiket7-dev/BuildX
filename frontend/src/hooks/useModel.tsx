import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export const AVAILABLE_MODELS = [
  { id: 'llama-3.3-70b', label: 'Llama 3.3 70B', badge: 'Fast & Smart' },
  { id: 'llama-3.1-8b', label: 'Llama 3.1 8B', badge: 'Ultra Fast' },
  { id: 'qwen-3-32b', label: 'Qwen 3 32B', badge: 'Coding Pro' },
  { id: 'gpt-oss-120b', label: 'GPT-OSS 120B', badge: 'Premium (5/day)' },
] as const;

export type ModelId = typeof AVAILABLE_MODELS[number]['id'];

interface ModelContextType {
  selectedModel: ModelId;
  setSelectedModel: (model: ModelId) => void;
}

const ModelContext = createContext<ModelContextType | undefined>(undefined);

export function ModelProvider({ children }: { children: ReactNode }) {
  // Read from local storage to persist the user's choice, defaulting to llama-3.3-70b
  const [selectedModel, setSelectedModel] = useState<ModelId>(() => {
    const saved = localStorage.getItem('buildx_selected_model');
    return (AVAILABLE_MODELS.find(m => m.id === saved)?.id as ModelId) || 'llama-3.3-70b';
  });

  useEffect(() => {
    localStorage.setItem('buildx_selected_model', selectedModel);
  }, [selectedModel]);

  return (
    <ModelContext.Provider value={{ selectedModel, setSelectedModel }}>
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
