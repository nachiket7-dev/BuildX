import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { sql } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';
import { EditorSelection, EditorState } from '@codemirror/state';
import { unifiedMergeView } from '@codemirror/merge';
import { buildxEditorTheme, buildxExtensions } from './theme/buildxTheme';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { fetchBlueprintFilesWithContent, fetchBlueprint, fetchMyBlueprints } from '../lib/api';
import type { Blueprint } from '../lib/types';
import { LivePreview } from './LivePreview';
import { WorkspaceFileTree } from './WorkspaceFileTree';
import { useCodeGeneration } from '../hooks/useCodeGeneration';
import { useVFS } from '../context/VFSContext';
import { CommandPalette, type PaletteAction } from './CommandPalette';
import {
  Cpu,
  FileCode,
  Send,
  Loader2,
  Sparkles,
  ArrowLeft,
  CheckSquare,
  PlayCircle,
  FileText,
  ChevronDown,
  ChevronRight,
  Brain,
  Terminal,
  GitCompare,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Activity,
  Check,
  Search,
  Database,
} from 'lucide-react';

const cursorInlineDiffTheme = EditorView.theme({
  '.cm-merge-b, .cm-insertedLine, .cm-change-b': {
    backgroundColor: 'rgba(16, 185, 129, 0.25) !important',
    color: '#34D399 !important',
  },
  '.cm-merge-a, .cm-deletedLine, .cm-change-a': {
    backgroundColor: 'rgba(239, 68, 68, 0.25) !important',
    color: '#F87171 !important',
    textDecoration: 'line-through !important',
  },
});

function getLanguageExtension(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'tsx':
      return [javascript({ jsx: true, typescript: true })];
    case 'ts':
      return [javascript({ typescript: true })];
    case 'jsx':
      return [javascript({ jsx: true })];
    case 'js':
      return [javascript()];
    case 'json':
      return [json()];
    case 'html':
      return [html()];
    case 'css':
      return [css()];
    case 'sql':
      return [sql()];
    default:
      return [javascript({ jsx: true, typescript: true })];
  }
}

interface VfsFile {
  path: string;
  content: string;
  language: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  thinkingSteps?: string[];
  model?: string;
  telemetry?: {
    planner?: { modelUsed: string; executionTimeMs?: number; wasFallback?: boolean };
    patches?: Array<{ filePath: string; modelUsed: string; executionTimeMs?: number; wasFallback?: boolean }>;
  };
}

function formatAgentModelName(modelKey?: string): string {
  if (!modelKey) return 'Gemini 3.5 Flash';
  const map: Record<string, string> = {
    'gemini-3.5-flash': 'Gemini 3.5 Flash',
    'gemini-3.1-pro': 'Gemini 3.1 Pro',
    'nemotron-3-super-120b': 'Nemotron 3 Super',
    'nemotron-3-550b': 'Nemotron 3 Ultra',
    'nemotron-3-ultra-550b': 'Nemotron 3 Ultra',
    'kimi-k2.6': 'Kimi K2.6',
    'glm-5.2': 'GLM 5.2',
    'gpt-oss-120b': 'GPT-OSS 120B',
    'qwen-3-32b': 'Qwen 3 32B',
  };
  return map[modelKey] || modelKey.split('/').pop() || modelKey;
}

export function AgentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { toast } = useToast();
  const vfs = useVFS();

  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);

  // Active workspace state
  const [appName, setAppName] = useState<string>('');
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [files, setFiles] = useState<VfsFile[]>([]);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [selectedFile, setSelectedFile] = useState<VfsFile | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');

  // Command Palette state
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  // Multi-tab state: track open file tabs with order
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [tabDirtyState, setTabDirtyState] = useState<Record<string, boolean>>({});

  // Tab management functions
  const openFileTab = useCallback((filePath: string) => {
    setOpenTabs((prev) => {
      if (prev.includes(filePath)) return prev;
      return [...prev, filePath];
    });
  }, []);

  const closeFileTab = useCallback((filePath: string) => {
    setOpenTabs((prev) => {
      const newTabs = prev.filter((t) => t !== filePath);
      // If closing the active file, switch to the last remaining tab
      if (selectedFile?.path === filePath && newTabs.length > 0) {
        const closingIdx = prev.indexOf(filePath);
        const nextIdx = Math.min(closingIdx, newTabs.length - 1);
        const nextPath = newTabs[nextIdx];
        const nextFile = files.find((f) => f.path === nextPath);
        if (nextFile) setSelectedFile(nextFile);
      } else if (newTabs.length === 0) {
        setSelectedFile(null);
      }
      return newTabs;
    });
    setTabDirtyState((prev) => {
      const next = { ...prev };
      delete next[filePath];
      return next;
    });
  }, [files, selectedFile]);

  // Auto-add tab when selecting a file
  const selectFileAndOpenTab = useCallback((file: VfsFile) => {
    setSelectedFile(file);
    setActiveTab('editor');
    openFileTab(file.path);
  }, [openFileTab]);

  // Subagent Telemetry State
  const [activeTelemetry, setActiveTelemetry] = useState<{
    planner?: { modelUsed: string; executionTimeMs?: number; wasFallback?: boolean };
    patch?: { modelUsed: string; executionTimeMs?: number; wasFallback?: boolean };
  }>({});

  // AI Diff Review State
  const [pendingDiff, setPendingDiff] = useState<{
    original: string;
    modified: string;
    filePath?: string;
  } | null>(null);
  const [patchFlash, setPatchFlash] = useState(false);
  const triggerPatchFlash = useCallback(() => {
    setPatchFlash(true);
    setTimeout(() => setPatchFlash(false), 600);
  }, []);
  const [diffKey, setDiffKey] = useState(0);
  const editorViewRef = useRef<EditorView | null>(null);
  const diffContainerRef = useRef<HTMLDivElement>(null);
  const diffEditorViewRef = useRef<EditorView | null>(null);
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    return () => {
      Object.values(saveTimersRef.current).forEach(clearTimeout);
    };
  }, []);

  // Mount raw DOM CodeMirror 6 unifiedMergeView when pendingDiff is active for selectedFile
  useEffect(() => {
    if (pendingDiff && selectedFile && (pendingDiff.filePath === selectedFile.path || !pendingDiff.filePath) && diffContainerRef.current) {
      if (diffEditorViewRef.current) {
        diffEditorViewRef.current.destroy();
        diffEditorViewRef.current = null;
      }
      diffContainerRef.current.innerHTML = '';

      const state = EditorState.create({
        doc: pendingDiff.modified,
        extensions: [
          ...getLanguageExtension(selectedFile.path),
          unifiedMergeView({
            original: pendingDiff.original,
            highlightChanges: true,
            syntaxHighlightDeletions: true,
            mergeControls: false,
            gutter: true,
          }),
          cursorInlineDiffTheme,
          ...buildxExtensions,
          buildxEditorTheme,
          EditorView.lineWrapping,
          EditorState.readOnly.of(true),
        ],
      });

      const view = new EditorView({
        state,
        parent: diffContainerRef.current,
      });

      diffEditorViewRef.current = view;

      return () => {
        if (diffEditorViewRef.current) {
          diffEditorViewRef.current.destroy();
          diffEditorViewRef.current = null;
        }
      };
    }
  }, [pendingDiff, selectedFile, diffKey]);

  // Agent states
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [plan, setPlan] = useState<string>('');
  const [isThinking, setIsThinking] = useState(false);
  const [liveThinkingSteps, setLiveThinkingSteps] = useState<string[]>([]);
  const [previewKey, setPreviewKey] = useState(0);
  const [agentModel, setAgentModel] = useState<string>('nemotron-3-550b');
  const [expandedThinking, setExpandedThinking] = useState<Record<number, boolean>>({});
  const [pipelineHeartbeat, setPipelineHeartbeat] = useState<{
    elapsedMs: number;
    activeStage: string;
    activeModel: string;
  } | null>(null);
  const [activePipelineStage, setActivePipelineStage] = useState<string>('INGESTION');
  const codegen = useCodeGeneration();

  // ── Global Cmd+K listener for Command Palette ─────────────────────────────
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // ── Command Palette action handler ────────────────────────────────────────
  const handlePaletteAction = useCallback((action: PaletteAction) => {
    switch (action.type) {
      case 'file': {
        const file = files.find(f => f.path === action.path);
        if (file) {
          selectFileAndOpenTab(file);
        }
        break;
      }
      case 'action': {
        switch (action.id) {
          case 'toggle-preview':
            setActiveTab((prev) => (prev === 'editor' ? 'preview' : 'editor'));
            break;
          case 'enhance-ui':
            if (id) {
              vfs.enhanceUi(id).then(() => {
                toast('UI enhancement applied!', 'success');
                setPreviewKey((k) => k + 1);
              }).catch((err: any) => toast(err.message || 'Enhancement failed', 'error'));
            }
            break;
          case 'run-autofix': {
            const errorCtx = vfs.runtimeError;
            if (errorCtx) {
              const autoFixPrompt = `Fix runtime preview error: ${errorCtx.message}${errorCtx.path ? ` in file ${errorCtx.path}` : ''}${errorCtx.line ? ` at line ${errorCtx.line}` : ''}`;
              handleSend(undefined, autoFixPrompt);
            } else {
              toast('No runtime errors detected to fix', 'info');
            }
            break;
          }
          case 'deploy-github':
          case 'export-zip':
            // Trigger deploy modal via outlet context
            // These are wired through AppShell's onDeploy callback
            break;
          default:
            break;
        }
        break;
      }
      case 'model':
        setAgentModel(action.modelKey);
        toast(`Model switched to ${action.modelKey}`, 'info');
        break;
      case 'prompt':
        handleSend(undefined, action.prompt);
        break;
    }
  }, [files, id, vfs, toast, handleSend]);

  const formatElapsed = (ms?: number) => {
    if (!ms || ms <= 0) return '00:00';
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}s`;
  };


  // Automatically refresh VFS files when codegen is done
  useEffect(() => {
    if (codegen.progress.status === 'completed' && id) {
      setLoadingWorkspace(true);
      fetchBlueprintFilesWithContent(id)
        .then(res => {
          setFiles(res);
          const first = res.find(
            f => f.path !== 'preview.html' && (f.path.endsWith('.tsx') || f.path.endsWith('.ts'))
          ) || res.find(f => f.path !== 'preview.html') || null;
          setSelectedFile(first);
          setPreviewKey(k => k + 1);
          toast('Workspace files initialized successfully!', 'success');
        })
        .catch(() => {})
        .finally(() => setLoadingWorkspace(false));
    }
  }, [codegen.progress.status, id]);

  // Load user's blueprints for workspace selector
  useEffect(() => {
    if (!id && token) {
      setLoadingWorkspaces(true);
      fetchMyBlueprints()
        .then(res => setWorkspaces(res || []))
        .catch(() => {})
        .finally(() => setLoadingWorkspaces(false));
    }
  }, [id, token]);

  // Load VFS, chat history, blueprint name
  useEffect(() => {
    if (id && token) {
      setLoadingWorkspace(true);
      const BASE_URL = import.meta.env.VITE_API_URL ?? '';

      fetchBlueprint(id)
        .then(bp => {
          setAppName(bp.appName);
          setBlueprint(bp);
        })
        .catch(() => {});

      const fetchFilesPromise = fetchBlueprintFilesWithContent(id)
        .then(async res => {
          if (res.length === 0) {
            try {
              const initRes = await fetch(`${BASE_URL}/api/blueprints/${id}/vfs/init`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
              });
              const json = await initRes.json();
              if (json.data?.files?.length) {
                res = json.data.files;
              }
            } catch {
              // ignore error
            }
          }
          setFiles(res);
          // Sync VFS context state
          vfs.loadVFS(id).catch(() => {});
          // Select first non-preview file
          const first = res.find(
            f => f.path !== 'preview.html' && (f.path.endsWith('.tsx') || f.path.endsWith('.ts'))
          ) || res.find(f => f.path !== 'preview.html') || null;
          setSelectedFile(first);
        })
        .catch(() => {});

      const fetchChatPromise = fetch(`${BASE_URL}/api/auth/chat/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(r => {
          if (r.success) {
            setMessages(r.data.map((m: any) => ({ role: m.role, content: m.content })));
          }
        })
        .catch(() => {});

      Promise.allSettled([fetchFilesPromise, fetchChatPromise]).finally(() => {
        setLoadingWorkspace(false);
      });
    }
  }, [id, token]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isSendingRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, liveThinkingSteps, isThinking, expandedThinking, scrollToBottom]);

  async function handleSend(e?: React.FormEvent, overridePrompt?: string) {
    if (e) e.preventDefault();
    const userMessage = (overridePrompt ?? prompt).trim();
    if (!userMessage || isThinking || isSendingRef.current || vfs.isAgentExecuting || !id || !token) return;

    isSendingRef.current = true;
    setPrompt('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsThinking(true);
    setLiveThinkingSteps([]);

    const collectedSteps: string[] = [];

    try {
      await vfs.streamAgentPrompt(id, userMessage, agentModel, {
        onThinking: (step) => {
          collectedSteps.push(step);
          setLiveThinkingSteps(prev => [...prev, step]);
        },
        onPipelineHeartbeat: (hb) => {
          setPipelineHeartbeat(hb);
          if (hb.activeStage) setActivePipelineStage(hb.activeStage);
        },
        onPipelineStage: (st) => {
          if (st.stage) setActivePipelineStage(st.stage);
        },
        onTelemetry: (payload) => {
          const { stage, modelUsed, executionTimeMs, wasFallback } = payload;
          if (stage === 'PLANNER') {
            setActiveTelemetry(prev => ({
              ...prev,
              planner: { modelUsed, executionTimeMs, wasFallback },
            }));
          } else if (stage === 'PATCH_GENERATOR') {
            setActiveTelemetry(prev => ({
              ...prev,
              patch: { modelUsed, executionTimeMs, wasFallback },
            }));
          }
        },
        onPlan: (newPlan) => {
          if (Array.isArray(newPlan)) {
            setPlan(newPlan.map((s: string) => `- [ ] ${s}`).join('\n'));
          }
        },
        onPatch: (payload) => {
          const { filePath, content, modelUsed, executionTimeMs, wasFallback } = payload;
          if (modelUsed) {
            setActiveTelemetry(prev => ({
              ...prev,
              patch: { modelUsed, executionTimeMs, wasFallback },
            }));
          }
          if (filePath && content) {
            const origContent = files.find(f => f.path === filePath)?.content || '';
            if (origContent.length > 200 && content.length < 100) {
              console.warn(`[AgentPage] Refusing to stage corrupt patch (<100 chars) for ${filePath}`);
            } else {
              const diffObj = { filePath, originalCode: origContent, incomingCode: content, original: origContent, modified: content };
              setPendingDiff(diffObj);
              setDiffKey(k => k + 1);
              const ext = filePath.split('.').pop() || 'typescript';
              const targetF: VfsFile = files.find(f => f.path === filePath) || { path: filePath, content: origContent, language: ext };
              setSelectedFile(targetF);
              setActiveTab('editor');
              console.log(`[AgentPage] File patch staged for ${filePath}`);
            }
          }
        },
        onStagedDiff: (payload) => {
          const { path, original, modified } = payload;
          if (path && modified) {
            const origContent = original || files.find(f => f.path === path)?.content || '';
            if (origContent.length > 200 && modified.length < 100) {
              console.warn(`[AgentPage] Refusing to stage corrupt diff (<100 chars) for ${path}`);
            } else {
              const diffObj = { filePath: path, originalCode: origContent, incomingCode: modified, original: origContent, modified };
              setPendingDiff(diffObj);
              setDiffKey(k => k + 1);
              const ext = path.split('.').pop() || 'typescript';
              const targetF: VfsFile = files.find(f => f.path === path) || { path, content: origContent, language: ext };
              setSelectedFile(targetF);
              setActiveTab('editor');
              console.log(`[AgentPage] Staged diff for ${path}`);
            }
          }
        },
        onDone: (payload) => {
          const { message, plan: newPlan, modifiedFiles, stagedDiffs: serverStagedDiffs, telemetry: doneTelemetry } = payload;
          setLiveThinkingSteps([]);
          setPipelineHeartbeat(null);
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: message,
              thinkingSteps: [...collectedSteps],
              model: agentModel,
              telemetry: doneTelemetry || activeTelemetry,
            },
          ]);
          if (newPlan) setPlan(newPlan);

          if (serverStagedDiffs && typeof serverStagedDiffs === 'object') {
            for (const [filePath, diffData] of Object.entries(serverStagedDiffs as Record<string, { original: string; modified: string }>)) {
              if (diffData.modified) {
                vfs.stageFileDiff(filePath, diffData.modified, diffData.original || '');
                const diffObj = { filePath, originalCode: diffData.original || '', incomingCode: diffData.modified, original: diffData.original || '', modified: diffData.modified };
                setPendingDiff(diffObj);
                setDiffKey(k => k + 1);
                const fExt = filePath.split('.').pop() || 'typescript';
                const targetF: VfsFile = files.find(f => f.path === filePath) || { path: filePath, content: diffData.original || '', language: fExt };
                setSelectedFile(targetF);
                setActiveTab('editor');
              }
            }
          }

          setPreviewKey(k => k + 1);
          if (modifiedFiles?.length) {
            toast(`${modifiedFiles.length} file(s) modified — review inline diff below`, 'info');
          }
        },
        onError: (errMsg) => {
          setLiveThinkingSteps([]);
          setPipelineHeartbeat(null);
          setMessages(prev => [
            ...prev,
            { role: 'assistant', content: errMsg, thinkingSteps: [...collectedSteps], model: agentModel },
          ]);
          toast(errMsg, 'error');
        },
      });
    } catch (err: any) {
      setLiveThinkingSteps([]);
      setPipelineHeartbeat(null);
      const msg = err.message || 'Failed to connect to agent';
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: msg, model: agentModel },
      ]);
      toast(msg, 'error');
    } finally {
      isSendingRef.current = false;
      setIsThinking(false);
    }
  }

  // ─── Bidirectional Element-to-Code Selection & Auto-Fix Message Listener ──
  useEffect(() => {
    const handleInspectJump = (targetFile?: string, targetLine?: number, el?: any) => {
      setActiveTab('editor');
      if (targetFile) {
        const found = files.find((f) => f.path === targetFile);
        if (found) {
          setSelectedFile(found);
        }
      }

      setTimeout(() => {
        const view = editorViewRef.current;
        if (!view) return;

        if (targetLine && targetLine > 0) {
          const clampedLine = Math.min(Math.max(targetLine, 1), view.state.doc.lines);
          const line = view.state.doc.line(clampedLine);
          view.dispatch({
            selection: { anchor: line.from, head: line.to },
            scrollIntoView: true,
          });
          view.focus();
          triggerPatchFlash();
          const fname = (targetFile || selectedFile?.path || '').split('/').pop() || 'file';
          toast(`Inspected component: jumped to line ${clampedLine} in ${fname}`, 'info');
          return;
        }

        if (el) {
          const doc = view.state.doc.toString();
          const candidates = [
            el.textContent,
            el.placeholder ? `placeholder="${el.placeholder}"` : '',
            el.placeholder,
            el.ariaLabel ? `aria-label="${el.ariaLabel}"` : '',
            el.ariaLabel,
            el.title ? `title="${el.title}"` : '',
            el.id ? `id="${el.id}"` : '',
            el.id,
            el.className ? el.className.split(' ').filter((c: string) => c.length > 4 && !c.includes(':'))[0] : '',
            el.tagName && el.tagName !== 'div' ? `<${el.tagName}` : '',
          ].filter(Boolean);

          let matchPos = -1;
          let matchLen = 0;

          for (const cand of candidates) {
            if (!cand || cand.length < 2) continue;
            const idx = doc.indexOf(cand);
            if (idx !== -1) {
              matchPos = idx;
              matchLen = cand.length;
              break;
            }
          }

          if (matchPos !== -1) {
            view.dispatch({
              selection: EditorSelection.single(matchPos, matchPos + matchLen),
              scrollIntoView: true,
            });
            view.focus();
            triggerPatchFlash();
            toast(`Inspected element: "${candidates[0]}"`, 'info');
          }
        }
      }, 70);
    };

    const handlePreviewMessage = (event: MessageEvent) => {
      if (event.data?.type === 'BUILDX_INSPECT_CODE_TARGET') {
        const { targetFile, targetLine, element } = event.data;
        handleInspectJump(targetFile, targetLine, element);
      } else if (event.data?.type === 'buildx:preview-element-click' && event.data.element) {
        handleInspectJump(undefined, undefined, event.data.element);
      }
    };

    const handleCustomInspect = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail) {
        const { targetFile, targetLine, element } = custom.detail;
        handleInspectJump(targetFile, targetLine, element);
      }
    };

    const handleCustomAutoFix = (e: Event) => {
      if (isThinking || isSendingRef.current) return;
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail;
      const autoFixPrompt = detail?.prompt || detail?.message || (detail?.error
        ? `Fix runtime preview error in file ${detail.error.path || 'active component'}: ${detail.error.message || detail.error}${detail.error.line ? ` at line ${detail.error.line}` : ''}`
        : null);
      if (autoFixPrompt) {
        setPrompt(autoFixPrompt);
        handleSend(undefined, autoFixPrompt);
        toast('Dispatched auto-fix command to Cortex Agent', 'info');
      }
    };

    window.addEventListener('message', handlePreviewMessage);
    window.addEventListener('buildx:inspect_target', handleCustomInspect);
    window.addEventListener('buildx:trigger-autofix', handleCustomAutoFix);

    return () => {
      window.removeEventListener('message', handlePreviewMessage);
      window.removeEventListener('buildx:inspect_target', handleCustomInspect);
      window.removeEventListener('buildx:trigger-autofix', handleCustomAutoFix);
    };
  }, [files, selectedFile, toast, isThinking]);

  // ─── Diff Accept/Reject Handlers & Shortcuts (⌘Enter / Esc) ────────────────
  const handleAcceptDiff = useCallback(async () => {
    if (!pendingDiff || !selectedFile || !id) return;
    const targetPath = pendingDiff.filePath || selectedFile.path;
    const targetContent = pendingDiff.modified;

    try {
      await vfs.acceptDiff(id, targetPath);

      setFiles((prev) =>
        prev.map((f) => (f.path === targetPath ? { ...f, content: targetContent } : f))
      );
      setSelectedFile((prev) => (prev ? { ...prev, content: targetContent } : null));
      setPatchFlash(true);
      setTimeout(() => setPatchFlash(false), 600);
      setPendingDiff(null);
      setPreviewKey((k) => k + 1);
      toast('AI changes accepted and applied to workspace!', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to apply changes', 'error');
    }
  }, [pendingDiff, selectedFile, id, toast, vfs]);

  const handleRejectDiff = useCallback(() => {
    setPendingDiff(null);
    toast('Proposed AI changes discarded', 'info');
  }, [toast]);

  useEffect(() => {
    if (!pendingDiff) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleAcceptDiff();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleRejectDiff();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingDiff, handleAcceptDiff, handleRejectDiff]);

  const visibleFiles = files.filter(f => f.path !== 'preview.html');
  const previewFiles = useMemo(
    () => Object.fromEntries(files.map(file => [file.path, file.content])),
    [files]
  );

  // ── Workspace selector ────────────────────────────────────────────────────
  if (!id) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-5xl mx-auto w-full">
        <div className="w-full flex items-center justify-between mb-8 pb-3 border-b border-white/5 font-sans">
          <button
            onClick={() => navigate('/gallery')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white hover:border-indigo-500/40 hover:bg-indigo-500/10 text-xs font-semibold transition-all font-sans"
          >
            <ArrowLeft size={13} />
            <span>Back to Gallery</span>
          </button>
          <span className="text-[11px] font-mono text-zinc-500">CORTEX AGENT WORKSPACE</span>
        </div>

        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
            <Cpu className="text-indigo-400" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Cortex Agent Workspace</h1>
          <p className="text-gray-400 text-sm max-w-md">
            Select a project workspace to plan, edit files, and build code interactively with AI.
          </p>
        </div>

        {loadingWorkspaces ? (
          <div className="flex flex-col items-center gap-2 py-12">
            <Loader2 className="animate-spin text-indigo-400" size={24} />
            <span className="text-xs text-gray-500 font-mono tracking-tight">Loading workspaces…</span>
          </div>
        ) : workspaces.length === 0 ? (
          <div className="text-center py-12 border border-white/5 bg-white/[0.02] rounded-2xl px-8 max-w-md w-full">
            <p className="text-sm text-gray-400 mb-4 font-sans">You don't have any blueprints yet.</p>
            <button
              onClick={() => navigate('/create')}
              className="px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold rounded-xl transition-all font-sans"
            >
              Build your first app
            </button>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          >
            {workspaces.map(w => (
              <motion.button
                key={w.id}
                onClick={() => navigate(`/agent/${w.id}`)}
                variants={{
                  hidden: { opacity: 0, y: 20, scale: 0.97 },
                  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
                }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-start text-left p-5 bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-indigo-500/20 rounded-2xl transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-lg font-bold text-indigo-400 shrink-0 mr-4 group-hover:scale-105 transition-transform font-mono">
                  {w.appName?.[0]?.toUpperCase() || 'A'}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-white truncate font-sans">{w.appName}</h3>
                  <p className="text-xs text-gray-400 truncate mt-1 font-sans">{w.idea}</p>
                  <span className="inline-block mt-3 text-[10px] font-mono text-indigo-400 border border-indigo-500/10 px-2 py-0.5 rounded tracking-tight">
                    Open IDE Studio →
                  </span>
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </div>
    );
  }

  // ── Active workspace: Studio 3-Column Layout ─────────────────────────────
  return (
    <div className="w-full h-full overflow-hidden flex flex-col bg-[#08080c] text-white relative selection:bg-purple-500 selection:text-white font-sans">
      {/* Top Ambient Mesh Light */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[250px] bg-emerald-500/10 blur-[150px] pointer-events-none rounded-full" />

      {/* ── Floating Telemetry Status Pill (visible during pipeline execution) ── */}
      <AnimatePresence>
        {isThinking && pipelineHeartbeat && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-1.5 rounded-full bg-[#0c0c14]/90 backdrop-blur-2xl border border-indigo-500/20 shadow-xl shadow-indigo-900/20"
          >
            {/* Pulsing dot */}
            <span className="relative flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>

            {/* Active stage */}
            <span className="text-[10px] font-mono font-bold text-indigo-300 uppercase tracking-wider">
              {activePipelineStage === 'INGESTION' ? 'Ingesting' :
               activePipelineStage === 'PLANNING' ? 'Planning' :
               activePipelineStage === 'DIFF_GENERATION' ? 'Patching' :
               activePipelineStage === 'SCHEMA_VERIFIER' ? 'Verifying' :
               activePipelineStage}
            </span>

            <span className="w-px h-3 bg-white/10" />

            {/* Active model */}
            <span className="text-[10px] font-mono text-gray-400">
              <span className="text-white/80 font-semibold">
                {formatAgentModelName(pipelineHeartbeat.activeModel)}
              </span>
            </span>

            <span className="w-px h-3 bg-white/10" />

            {/* Elapsed time */}
            <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
              <Clock size={10} className="animate-pulse" />
              {formatElapsed(pipelineHeartbeat.elapsedMs)}
            </span>

            <span className="w-px h-3 bg-white/10" />

            {/* File count */}
            <span className="text-[10px] font-mono text-gray-500">
              {visibleFiles.length} files
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Flex Workspace Wrapper ── */}
      <div className="flex-1 min-h-0 w-full flex overflow-hidden relative z-10 bg-[#08080c]">

        {/* ── 1. Workspace File Tree Column ────────────── */}
        {/* ── 1. Workspace File Tree (240px, clean glassmorphic IDE layout) ── */}
        <aside className="w-60 shrink-0 h-full border-r border-white/[0.08] bg-[#090a10]/95 backdrop-blur-xl flex flex-col min-h-0">
          <WorkspaceFileTree
            files={files}
            activeFilePath={selectedFile?.path}
            onSelectFile={(path) => {
              const file = files.find(f => f.path === path);
              if (file) {
                selectFileAndOpenTab(file);
              }
            }}
            isLoading={loadingWorkspace}
          />
        </aside>

        {/* ── 2. Center Code Editor (w-0 flex-1 — absorbs all remaining space) ── */}
        <main className="flex-1 w-0 min-w-0 h-full relative overflow-hidden bg-[#08080c] flex flex-col">

        {/* Tab Bar Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-3 h-11 shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => navigate('/gallery')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white hover:border-indigo-500/30 hover:bg-indigo-500/10 text-[11px] font-mono transition-all shrink-0"
              title="Return to Gallery"
            >
              <ArrowLeft size={12} />
              <span className="hidden sm:inline">Gallery</span>
            </button>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] relative">
              {(
                [
                  { key: 'editor',   label: '01 CODE',     icon: <FileCode size={12} /> },
                  { key: 'preview',  label: '02 PREVIEW',  icon: <PlayCircle size={12} /> },
                ] as const
              ).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-mono font-medium transition-colors z-10 ${
                    activeTab === tab.key ? 'text-white' : 'text-neutral-500 hover:text-white'
                  }`}
                >
                  {activeTab === tab.key && (
                    <motion.div
                      layoutId="studioActiveTab"
                      className="absolute inset-0 rounded-lg bg-indigo-500/20 border border-indigo-500/30"
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">{tab.icon}{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {selectedFile && activeTab === 'editor' && (
            <div className="flex items-center gap-2 font-mono text-[11px] text-gray-400 truncate min-w-0 tracking-tight">
              <button
                onClick={() => setIsPaletteOpen(true)}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg border border-white/10 bg-white/[0.03] text-gray-500 hover:text-white hover:border-indigo-500/30 hover:bg-indigo-500/10 text-[10px] font-mono transition-all shrink-0"
                title="Search files (⌘K)"
              >
                <Search size={10} />
                <span className="hidden lg:inline">⌘K</span>
              </button>
            </div>
          )}
        </div>

        {/* Multi-Tab File Bar */}
        {openTabs.length > 0 && activeTab === 'editor' && (
          <div className="flex items-center border-b border-white/[0.04] bg-[#0a0a0e] overflow-x-auto custom-scrollbar shrink-0">
            {openTabs.map((tabPath) => {
              const isActive = selectedFile?.path === tabPath;
              const isDirty = tabDirtyState[tabPath];
              const tabFile = files.find(f => f.path === tabPath);
              const fileName = tabPath.split('/').pop() || tabPath;
              const ext = tabPath.split('.').pop()?.toLowerCase();

              const getTabIcon = () => {
                if (ext === 'sql' || tabPath.includes('schema')) return <Database size={12} className="text-purple-400" />;
                if (ext === 'tsx' || ext === 'ts') return <FileCode size={12} className="text-blue-400" />;
                if (ext === 'json') return <FileCode size={12} className="text-amber-400" />;
                if (ext === 'md') return <FileText size={12} className="text-emerald-400" />;
                return <FileCode size={12} className="text-gray-400" />;
              };

              return (
                <div
                  key={tabPath}
                  className={`group relative flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono cursor-pointer border-r border-white/[0.04] select-none transition-colors ${
                    isActive
                      ? 'bg-[#08080c] text-white border-b-2 border-b-indigo-500'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02] border-b-2 border-b-transparent'
                  }`}
                  onClick={() => {
                    if (tabFile) setSelectedFile(tabFile);
                  }}
                  onAuxClick={(e) => {
                    // Middle-click to close
                    if (e.button === 1) {
                      e.preventDefault();
                      closeFileTab(tabPath);
                    }
                  }}
                  title={tabPath}
                >
                  {getTabIcon()}
                  <span className="truncate max-w-[120px]">{fileName}</span>
                  {isDirty && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeFileTab(tabPath);
                    }}
                    className="ml-0.5 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-gray-500 hover:text-white transition-all shrink-0"
                    title="Close tab"
                  >
                    <XCircle size={10} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab Panels */}
        <div className="flex-1 overflow-hidden relative min-w-0">

          {/* Code Editor */}
          <div className={`absolute inset-0 flex flex-col overflow-hidden ${activeTab === 'editor' ? '' : 'hidden'}`}>
            <AnimatePresence>
              {patchFlash && (
                <motion.div
                  key="patch-flash-agent"
                  initial={{ opacity: 0.6 }}
                  animate={{ opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.55, ease: 'easeOut' }}
                  className="absolute inset-0 z-30 pointer-events-none rounded-xl"
                  style={{
                    background:
                      'radial-gradient(ellipse at center, rgba(16,185,129,0.3) 0%, transparent 70%)',
                  }}
                />
              )}
            </AnimatePresence>

            {visibleFiles.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-xs p-6 text-center max-w-sm mx-auto">
                <Terminal size={24} className="opacity-30 mb-2" />
                <span>Initialize the VFS workspace files first to edit or view code.</span>
              </div>
            ) : pendingDiff !== null && selectedFile ? (
              <div className="h-full flex flex-col min-h-0 relative">
                {/* Floating Diff Review Action Bar */}
                <div className="z-20 flex items-center justify-between px-4 py-2 bg-indigo-950/60 backdrop-blur-md border-b border-indigo-500/30 text-indigo-300 text-xs shrink-0 shadow-lg">
                  <div className="flex items-center gap-2 font-mono">
                    <GitCompare size={14} className="text-indigo-400 shrink-0" />
                    <span>
                      AI Diff Review Mode — <strong className="text-white">{selectedFile.path}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAcceptDiff}
                      className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 text-xs font-bold font-mono transition-all hover:scale-105 shadow-sm shadow-emerald-500/20"
                      title="Accept Changes (⌘+Enter)"
                    >
                      <CheckCircle2 size={13} />
                      <span>Accept Changes (⌘Enter)</span>
                    </button>
                    <button
                      onClick={handleRejectDiff}
                      className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 flex items-center gap-1.5 text-xs font-bold font-mono transition-all hover:scale-105 shadow-sm shadow-red-500/20"
                      title="Reject (Esc)"
                    >
                      <XCircle size={13} />
                      <span>Reject (Esc)</span>
                    </button>
                  </div>
                </div>

                {/* CodeMirror 6 Unified Merge View Engine - Raw DOM Mount */}
                <div
                  ref={diffContainerRef}
                  className="flex-1 overflow-auto relative min-h-0 bg-[#08080c] [&>.cm-editor]:h-full [&>.cm-editor]:text-xs [&>.cm-editor]:font-mono"
                />
              </div>
            ) : selectedFile ? (
              <div className="h-full flex-1 min-h-0 overflow-hidden relative">
                <CodeMirror
                  value={selectedFile.content}
                  height="100%"
                  theme={buildxEditorTheme}
                  extensions={[
                    ...getLanguageExtension(selectedFile.path),
                    ...buildxExtensions,
                    EditorView.lineWrapping,
                  ]}
                  onCreateEditor={(view) => {
                    editorViewRef.current = view;
                  }}
                  onChange={(val) => {
                    const path = selectedFile.path;
                    setSelectedFile((prev) => (prev ? { ...prev, content: val } : null));
                    setFiles((prev) =>
                      prev.map((f) => (f.path === path ? { ...f, content: val } : f))
                    );
                    if (id) {
                      const previousTimer = saveTimersRef.current[path];
                      if (previousTimer) clearTimeout(previousTimer);
                      saveTimersRef.current[path] = setTimeout(() => {
                        delete saveTimersRef.current[path];
                        vfs.updateFile(id, path, val).catch((err: Error) => {
                          toast(err.message || 'Failed to save file changes', 'error');
                        });
                      }, 400);
                    }
                  }}
                  className="h-full text-xs font-mono"
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-xs gap-2 font-mono">
                <FileCode size={24} className="opacity-30" />
                <span>Select a file from the left sidebar or Overview.</span>
              </div>
            )}
          </div>

          {/* Live Preview */}
          <div className={`absolute inset-0 overflow-y-auto p-4 ${activeTab === 'preview' ? '' : 'hidden'}`}>
            <LivePreview
              files={previewFiles}
              blueprintId={id}
              appName={appName}
              layoutParadigm={blueprint?.layoutParadigm}
              productArchetype={blueprint?.productArchetype}
              primaryLandingScreenId={blueprint?.primaryLandingScreenId}
              blueprint={blueprint}
              key={previewKey}
              onPromptAgent={(p) => {
                setPrompt(p);
                handleSend(undefined, p);
              }}
            />
          </div>
        </div>
      </main>

      {/* ── 3. Cortex Agent Right Panel (w-80 shrink-0 — always visible) ── */}
      <aside className="w-80 shrink-0 h-full overflow-hidden border-l border-white/10 bg-[#08080c] z-10 studio-card flex flex-col min-h-0">

        {/* Panel Header */}
        <div className="p-3 border-b border-white/5 flex flex-col gap-2 shrink-0 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/agent')}
                className="p-1 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                title="Back to Workspaces"
              >
                <ArrowLeft size={14} />
              </button>
              <Cpu size={14} className="text-indigo-400 shrink-0" />
              <span className="text-xs font-bold text-white">Cortex Agent</span>
            </div>

            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono shrink-0 transition-all tracking-tight ${isThinking ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-gray-500'}`}>
              {isThinking && <Loader2 className="animate-spin text-emerald-400" size={10} />}
              <span>{isThinking ? 'Thinking…' : 'Idle'}</span>
            </div>
          </div>

          {/* Multi-Model Telemetry Badges */}
          <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-indigo-950/30 border border-indigo-500/20 text-[10px] font-mono text-indigo-300 tracking-tight">
            <div className="flex items-center justify-between font-semibold">
              <span>Subagent Pipeline Telemetry</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                Active
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[9px] text-gray-400 pt-1 border-t border-indigo-500/10 font-mono">
              <div className="flex items-center gap-1">
                <Brain size={9} className="text-purple-400 shrink-0" />
                <span className="truncate">
                  PLAN:{' '}
                  <span className={`font-semibold ${activeTelemetry.planner?.wasFallback ? 'text-amber-400' : 'text-purple-300'}`}>
                    {formatAgentModelName(activeTelemetry.planner?.modelUsed || 'nemotron-3-550b')}
                  </span>
                  {activeTelemetry.planner?.wasFallback && (
                    <span className="ml-1 px-1 rounded bg-amber-500/30 text-amber-300 text-[8px] font-bold">FALLBACK</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <GitCompare size={9} className="text-emerald-400 shrink-0" />
                <span className="truncate">
                  PATCH:{' '}
                  <span className={`font-semibold ${activeTelemetry.patch?.wasFallback ? 'text-amber-400' : 'text-emerald-300'}`}>
                    {formatAgentModelName(activeTelemetry.patch?.modelUsed || 'kimi-k2.6')}
                  </span>
                  {activeTelemetry.patch?.wasFallback && (
                    <span className="ml-1 px-1 rounded bg-amber-500/30 text-amber-300 text-[8px] font-bold">FALLBACK</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Layers size={9} className="text-sky-400 shrink-0" />
                <span>INGEST: <span className="text-sky-300 font-semibold">GLM 5.2</span></span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle2 size={9} className="text-amber-400 shrink-0" />
                <span>GUARD: <span className="text-amber-300 font-semibold">Gemini Flash</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* Task Checklist Stream */}
        <AnimatePresence initial={false}>
          {plan && (
            <motion.div
              key="plan-checklist"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="overflow-hidden border-b border-white/5 bg-emerald-500/[0.02] shrink-0"
            >
              <div className="p-2.5">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 uppercase tracking-widest font-semibold mb-1">
                  <CheckSquare size={11} />
                  <span>Task Checklist</span>
                </div>
                <pre className="text-[11px] text-gray-400 font-mono whitespace-pre-wrap max-h-20 overflow-y-auto leading-relaxed">
                  {plan}
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Conversation Stream */}
        <div
          ref={chatScrollRef}
          className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 font-mono text-xs chat-scroll-area scroll-smooth"
        >
          {messages.length === 0 && !isThinking && (
            <div className="text-center py-10 px-3">
              <Sparkles className="mx-auto text-indigo-400/40 mb-2 animate-pulse" size={20} />
              <p className="text-[11px] text-gray-400 leading-relaxed font-sans">
                Describe code edits or features to build. The multi-model pipeline plans, generates diff patches, and applies fixes live.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex flex-col max-w-[92%] rounded-xl text-[11px] leading-relaxed overflow-hidden ${
                msg.role === 'user'
                  ? 'bg-purple-500/15 border border-purple-500/30 text-purple-200 self-end ml-auto p-2.5'
                  : 'bg-white/[0.04] border border-white/5 text-gray-300 self-start'
              }`}
            >
              {msg.role === 'assistant' ? (
                <>
                  {/* Thinking steps accordion */}
                  {msg.thinkingSteps && msg.thinkingSteps.length > 0 && (
                    <div className="border-b border-white/5 p-2 bg-black/20">
                      <button
                        onClick={() =>
                          setExpandedThinking(prev => ({ ...prev, [i]: !prev[i] }))
                        }
                        className="flex items-center gap-1.5 text-[10px] font-mono text-gray-500 hover:text-emerald-400 transition-colors w-full text-left tracking-tight"
                      >
                        <Brain size={10} className="text-emerald-500/60 shrink-0" />
                        <span className="uppercase tracking-widest font-semibold">
                          Pipeline thought for {msg.thinkingSteps.length} step{msg.thinkingSteps.length !== 1 ? 's' : ''}
                        </span>
                        {expandedThinking[i] ? <ChevronDown size={10} className="ml-auto" /> : <ChevronRight size={10} className="ml-auto" />}
                      </button>
                      {expandedThinking[i] && (
                        <div className="mt-2 space-y-1 max-h-40 overflow-y-auto pr-1 font-mono">
                          {msg.thinkingSteps.map((step, si) => (
                            <div key={si} className="text-[10px] text-gray-400 leading-relaxed border-l-2 border-emerald-500/20 pl-2 py-0.5">
                              {step}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5 font-mono text-[9px]">
                      <span className="uppercase tracking-wider text-emerald-400/80 font-semibold">
                        Subagents · Verified
                      </span>

                      {/* Active Subagent Model Badges */}
                      <div className="flex flex-wrap items-center gap-1">
                        <span
                          className={`px-1.5 py-0.5 rounded border ${
                            msg.telemetry?.planner?.wasFallback
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                              : 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                          }`}
                        >
                          PLAN: {formatAgentModelName(msg.telemetry?.planner?.modelUsed || 'nemotron-3-550b')}
                        </span>
                        <span className="px-1.5 py-0.5 rounded border bg-sky-500/15 border-sky-500/30 text-sky-300">
                          INGEST: GLM 5.2
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded border ${
                            msg.telemetry?.patches?.[0]?.wasFallback
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                              : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                          }`}
                        >
                          PATCH: {formatAgentModelName(msg.telemetry?.patches?.[0]?.modelUsed || 'kimi-k2.6')}
                        </span>
                        <span className="px-1.5 py-0.5 rounded border bg-amber-500/15 border-amber-500/30 text-amber-300">
                          GUARD: Gemini 3.5 Flash
                        </span>
                      </div>
                    </div>
                    <div className="whitespace-pre-wrap font-sans text-xs">{msg.content}</div>
                  </div>
                </>
              ) : (
                <div className="whitespace-pre-wrap font-sans text-xs">{msg.content}</div>
              )}
            </motion.div>
          ))}

          {isThinking && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="self-start flex flex-col w-full max-w-[96%] bg-[#0f0f17] border border-white/10 rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl relative overflow-hidden"
            >
              {/* Top ambient glow */}
              <div className="absolute top-0 right-0 w-48 h-20 bg-indigo-500/10 blur-2xl rounded-full pointer-events-none" />

              {/* Header: Title & Live Stopwatch */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.08] relative z-10">
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </div>
                  <span className="text-xs font-bold text-white font-mono tracking-tight flex items-center gap-1.5">
                    <Activity size={13} className="text-emerald-400" />
                    Autonomous Multi-Model Pipeline
                  </span>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-emerald-400 font-mono text-[11px]">
                  <Clock size={12} className="animate-pulse" />
                  <span className="font-semibold">{formatElapsed(pipelineHeartbeat?.elapsedMs || 0)}</span>
                </div>
              </div>

              {/* 4-Stage Live Subagent Stepper */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 relative z-10">
                {(
                  [
                    {
                      id: 'INGESTION',
                      num: '1',
                      title: 'Context & Ingestion',
                      model: 'GLM 5.2',
                      provider: 'OpenRouter',
                      color: 'sky',
                      icon: <Layers size={12} />,
                    },
                    {
                      id: 'PLANNING',
                      num: '2',
                      title: 'Neural Task Planner',
                      model: 'Gemini 3.5 Flash',
                      provider: 'Google AI Studio',
                      color: 'purple',
                      icon: <Brain size={12} />,
                    },
                    {
                      id: 'DIFF_GENERATION',
                      num: '3',
                      title: 'AST Patch Synthesizer',
                      model: 'Gemini 3.5 Flash',
                      provider: 'Google AI Studio',
                      color: 'emerald',
                      icon: <GitCompare size={12} />,
                    },
                    {
                      id: 'SCHEMA_VERIFIER',
                      num: '4',
                      title: 'AST & Safety Verifier',
                      model: 'Gemini 3.5 Flash',
                      provider: 'Google AI Studio',
                      color: 'amber',
                      icon: <CheckCircle2 size={12} />,
                    },
                  ] as const
                ).map(stageItem => {
                  const stageOrder = ['INGESTION', 'PLANNING', 'DIFF_GENERATION', 'SCHEMA_VERIFIER'];
                  const currentIndex = stageOrder.indexOf(activePipelineStage || 'INGESTION');
                  const thisIndex = stageOrder.indexOf(stageItem.id);
                  const isCurrent = activePipelineStage === stageItem.id || (currentIndex === thisIndex);
                  const isDone = currentIndex > thisIndex;

                  return (
                    <motion.div
                      key={stageItem.id}
                      animate={isCurrent ? { scale: [1, 1.015, 1], transition: { repeat: Infinity, duration: 2.5 } } : {}}
                      className={`p-2 rounded-xl border transition-all text-[10px] font-mono flex flex-col justify-between ${
                        isCurrent
                          ? 'bg-indigo-950/40 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                          : isDone
                          ? 'bg-emerald-950/20 border-emerald-500/20 opacity-85'
                          : 'bg-white/[0.02] border-white/5 opacity-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <span
                            className={`p-1 rounded-md ${
                              isCurrent
                                ? 'bg-indigo-500/20 text-indigo-300'
                                : isDone
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-white/5 text-gray-400'
                            }`}
                          >
                            {stageItem.icon}
                          </span>
                          <span className={isCurrent ? 'text-white' : isDone ? 'text-emerald-300' : 'text-gray-400'}>
                            {stageItem.title}
                          </span>
                        </div>

                        {isCurrent ? (
                          <Loader2 size={11} className="animate-spin text-indigo-400 shrink-0" />
                        ) : isDone ? (
                          <Check size={11} className="text-emerald-400 shrink-0" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-1 text-[9px]">
                        <span className="text-gray-400 font-sans">{stageItem.provider}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded font-mono font-bold ${
                            isCurrent
                              ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-500/40'
                              : isDone
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-white/5 text-gray-500'
                          }`}
                        >
                          {stageItem.model}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Streaming Thought Stream Log */}
              {liveThinkingSteps.length > 0 && (
                <div className="mt-1 bg-black/40 rounded-xl p-2.5 border border-white/5 max-h-36 overflow-y-auto space-y-1.5 font-mono text-[10px]">
                  <div className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold mb-1 flex items-center gap-1">
                    <Brain size={10} className="text-indigo-400" />
                    <span>Agent Internal Monologue</span>
                  </div>
                  {liveThinkingSteps.map((step, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-gray-300 border-l-2 border-indigo-500/40 pl-2 py-0.5 leading-relaxed"
                    >
                      {step}
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Pinned Bottom Chat Input */}
        <form onSubmit={handleSend} className="p-2.5 border-t border-white/5 bg-white/[0.02] flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder={isThinking ? 'Pipeline running…' : 'Ask Agent to refine code…'}
            disabled={isThinking}
            className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-indigo-500/50 font-mono"
          />
          <button
            type="submit"
            disabled={!prompt.trim() || isThinking}
            className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-30 transition-all shrink-0"
          >
            <Send size={14} />
          </button>
        </form>
      </aside>

      </div>

      {/* Command Palette (Cmd+K) */}
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onAction={handlePaletteAction}
        filePaths={visibleFiles.map(f => f.path)}
        appName={appName}
        isAgentBusy={isThinking}
      />
    </div>
  );
}
