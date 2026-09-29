import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { BuildXLiveEngine } from "./preview/BuildXLiveEngine";
import { getAuthHeaders } from "../lib/api";

export default function StandalonePreview() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [snapshot, setSnapshot] = useState<{
    appName: string;
    files: Record<string, string>;
    revision: string;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch(
      `${import.meta.env.VITE_API_URL ?? ""}/api/blueprint/${id}/preview/source?token=${encodeURIComponent(token)}`,
      { headers: getAuthHeaders(), signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Preview unavailable or link expired");
        return response.json();
      })
      .then(setSnapshot)
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      });
    return () => controller.abort();
  }, [id, token]);
  return (
    <main
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-primary, #0b0b0d)",
      }}
    >
      <header style={{ padding: "12px 20px" }}>
        {snapshot
          ? `${snapshot.appName} · Saved frontend preview · ${snapshot.revision.slice(0, 8)}`
          : "Loading saved preview…"}
      </header>
      {error ? (
        <p role="alert">{error}</p>
      ) : (
        snapshot && (
          <BuildXLiveEngine files={snapshot.files} appName={snapshot.appName} />
        )
      )}
    </main>
  );
}
