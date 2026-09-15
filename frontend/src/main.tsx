import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ModelProvider } from "./hooks/useModel";
import { ToastProvider } from "./hooks/useToast";
import "./index.css";
import "./product.css";
import "./experience.css";
import "./app-panels.css";
import "./studio.css";
import "./agent-workspace.css";
import "./interaction-polish.css";
import { MotionConfig } from "framer-motion";

// Silence third-party Sandpack telemetry beacons to keep developer console clean
if (typeof window !== "undefined" && window.fetch) {
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const url = typeof args[0] === "string" ? args[0] : (args[0] as any)?.url;
    if (url && typeof url === "string" && url.includes("csbops.io")) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return originalFetch.apply(window, args as any);
  };
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found in document");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <BrowserRouter>
            <ModelProvider>
              <App />
            </ModelProvider>
          </BrowserRouter>
        </ToastProvider>
      </MotionConfig>
    </QueryClientProvider>
  </React.StrictMode>,
);
