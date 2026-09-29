/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGENT_QUEUE_ENABLED?: string;
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
