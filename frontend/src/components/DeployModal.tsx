import { useEffect, useRef, useState } from "react";
import {
  Archive,
  ArrowUpRight,
  Check,
  Copy,
  Github,
  Globe,
} from './ui/icons';
import type { Blueprint, SavedBlueprint } from "../lib/types";
import {
  createBlueprintPreviewLink,
  downloadBlueprintZip,
  exportBlueprintToGithub,
  fetchBlueprint,
} from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { startGithubOAuth } from "../lib/utils";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
interface DeployModalProps {
  isOpen: boolean;
  onClose: () => void;
  blueprintId?: string;
  appName?: string;
  blueprint?: Blueprint;
  initialTarget?: ExportTarget;
}
export type ExportTarget = "sandbox" | "github" | "zip";
type Target = ExportTarget;
const targets = [
  {
    id: "sandbox" as const,
    title: "Create preview link",
    description: "Share the saved project in the BuildX preview engine.",
    Icon: Globe,
  },
  {
    id: "github" as const,
    title: "Export to GitHub",
    description: "Push the saved project to your connected GitHub account.",
    Icon: Github,
  },
  {
    id: "zip" as const,
    title: "Download source ZIP",
    description: "Download the saved project files for local development.",
    Icon: Archive,
  },
];
export function DeployModal({
  isOpen,
  onClose,
  blueprintId,
  appName,
  initialTarget = "zip",
}: DeployModalProps) {
  const { user } = useAuth();
  const [project, setProject] = useState<SavedBlueprint | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Target>(initialTarget);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ target: Target; url: string } | null>(
    null,
  );
  const [needsGithub, setNeedsGithub] = useState(false);
  const [copied, setCopied] = useState(false);
  const request = useRef(0);
  const operation = useRef(false);
  useEffect(() => {
    const ticket = ++request.current;
    setProject(null);
    setError("");
    setResult(null);
    setCopied(false);
    setNeedsGithub(false);
    setSelected(initialTarget);
    setBusy(false);
    operation.current = false;
    if (!isOpen || !blueprintId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchBlueprint(blueprintId)
      .then((data) => {
        if (ticket === request.current) setProject(data);
      })
      .catch((err) => {
        if (ticket === request.current)
          setError(
            err instanceof Error ? err.message : "Could not load this project.",
          );
      })
      .finally(() => {
        if (ticket === request.current) setLoading(false);
      });
    return () => {
      request.current = ticket + 1;
    };
  }, [isOpen, blueprintId, initialTarget]);
  const permitted =
    !!project && (selected === "zip" || (!!user && project.isOwner));
  async function run() {
    if (!permitted || !project || !blueprintId || operation.current) return;
    const ticket = request.current;
    const target = selected;
    operation.current = true;
    setBusy(true);
    setError("");
    setNeedsGithub(false);
    try {
      let url = "";
      if (target === "zip") await downloadBlueprintZip(blueprintId);
      else if (target === "sandbox")
        url = await createBlueprintPreviewLink(blueprintId);
      else {
        const response = await exportBlueprintToGithub(project, blueprintId);
        if (!response.success || !response.repoUrl)
          throw new Error("GitHub did not confirm the export.");
        url = response.repoUrl;
      }
      if (target !== "zip" && !url)
        throw new Error("The server did not return a link. Please retry.");
      if (ticket === request.current) setResult({ target, url });
    } catch (err) {
      if (ticket === request.current) {
        setError(
          err instanceof Error ? err.message : "Export failed. Please retry.",
        );
        setNeedsGithub(
          Boolean(
            (err as { require_github_auth?: boolean }).require_github_auth,
          ),
        );
      }
    } finally {
      if (ticket === request.current) {
        operation.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Export ${project?.appName || appName || "project"}`}
      description="Choose how you want to take the next step."
      size="lg"
    >
      {!blueprintId ? (
        <p role="status">Open a saved project before exporting.</p>
      ) : loading ? (
        <p role="status">Loading project details…</p>
      ) : result ? (
        <div className="export-result" role="status">
          <Check size={30} />
          <h3>
            {result.target === "zip"
              ? "Your ZIP download has started"
              : result.target === "github"
                ? "Your project was exported"
                : "Your preview link is ready"}
          </h3>
          {result.url && (
            <>
              <a href={result.url} target="_blank" rel="noreferrer">
                Open {result.target === "github" ? "repository" : "preview"}
                <ArrowUpRight size={16} />
              </a>
              <Button
                onClick={() => {
                  navigator.clipboard
                    .writeText(result.url)
                    .then(() => setCopied(true))
                    .catch(() =>
                      setError(
                        "Could not copy the link. Use the Open link instead.",
                      ),
                    );
                }}
              >
                <Copy size={14} />
                {copied ? "Copied" : "Copy link"}
              </Button>
            </>
          )}
          <Button onClick={onClose}>Done</Button>
        </div>
      ) : (
        <div className="export-options">
          <fieldset disabled={busy || !project}>
            <legend className="sr-only">Export format</legend>
            {targets.map(({ id, title, description, Icon }) => (
              <label key={id} className={selected === id ? "selected" : ""}>
                <input
                  type="radio"
                  name="export-target"
                  value={id}
                  checked={selected === id}
                  onChange={() => {
                    setSelected(id);
                    setError("");
                  }}
                />
                <Icon size={20} />
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
              </label>
            ))}
          </fieldset>
          {project && !permitted && (
            <p className="text-sm text-zinc-400">
              Only the project owner can create preview links or export to
              GitHub. You can download the available source files.
            </p>
          )}
          {needsGithub && (
            <Button
              onClick={() =>
                startGithubOAuth(
                  "link",
                  window.location.pathname + window.location.search,
                )
              }
            >
              Connect GitHub
            </Button>
          )}
          <Button
            variant="primary"
            loading={busy}
            disabled={!permitted}
            onClick={run}
          >
            {busy
              ? "Exporting…"
              : targets.find((target) => target.id === selected)?.title}
          </Button>
          <p className="text-xs text-zinc-400">
            Exports use saved files. Save your latest edits in the workspace
            first.
          </p>
        </div>
      )}
      {error && (
        <p className="mt-4 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
