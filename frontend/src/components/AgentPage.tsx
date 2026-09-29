import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
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
import { AgentRunHistory } from './AgentRunHistory';
import { AgentMessage, AgentRunStatus, type AgentChatMessage as ChatMessage } from './AgentConversation';
import { PanelResizeHandle } from './PanelResizeHandle';
import { useEventCallback } from '../hooks/useEventCallback';
import { useFileSave } from '../hooks/useFileSave';
import type { AppShellOutletContext } from './AppShell';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { fetchBlueprintFilesWithContent, fetchBlueprint, fetchMyBlueprints } from '../lib/api';
import type { Blueprint } from '../lib/types';
import { LivePreview } from './LivePreview';
import { WorkspaceFileTree } from './WorkspaceFileTree';
import { useCodeGeneration } from '../hooks/useCodeGeneration';
import { useVFS } from '../context/VFSContext';
import { queuedJobsEnabled } from '../lib/jobClient';
import { CommandPalette, type PaletteAction } from './CommandPalette';
import { SegmentedControl, Button } from './ui/primitives';
import {
  Cpu,
  FileCode,
  Send,
  Loader2,
  ArrowLeft,
  PlayCircle,
  FileText,
  ChevronRight,
  Terminal,
  GitCompare,
  CheckCircle2,
  XCircle,
  Search,
  Database,
  FlaskConical,
} from './ui/icons';

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

export function AgentPage() {
  const reducedMotion = useReducedMotion();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { toast } = useToast();
  const vfs = useVFS();
  const {loadVFS} = vfs;
  const {onDeploy} = useOutletContext<AppShellOutletContext>();
  const fileSave = useFileSave(id, vfs.updateFile);
  const [surface,setSurface] = useState<'files'|'code'|'preview'|'agent'>('code');
  const [fileWidth,setFileWidth] = useState(220);
  const [agentWidth,setAgentWidth] = useState(320);

  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);

  // Active workspace state
  const [workspaceError,setWorkspaceError]=useState('');
  const [loadAttempt,setLoadAttempt]=useState(0);
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

  useEffect(()=>{setTabDirtyState(prev=>{const next={...prev};for(const [path,state] of Object.entries(fileSave.states))next[path]=state!=='saved';return next;});},[fileSave.states]);

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
    setSurface('code');
    openFileTab(file.path);
  }, [openFileTab]);

  // Subagent Telemetry State
  const runTelemetry = useRef<NonNullable<ChatMessage['telemetry']>>({});

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
  // Recovery stages changes through VFS, without the live stream callbacks.
  useEffect(() => {
    const diff = vfs.pendingDiff;
    if (!diff) return;
    setPendingDiff({ filePath: diff.filePath, original: diff.originalCode, modified: diff.incomingCode });
    setSelectedFile(current => current?.path === diff.filePath ? current : {
      path: diff.filePath, content: diff.originalCode, language: diff.filePath.split('.').pop() || 'typescript',
    });
    setActiveTab('editor');
    setSurface('code');
    setDiffKey(key => key + 1);
  }, [vfs.pendingDiff]);

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
  const [agentModel, setAgentModel] = useState<string>('pipeline');
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

  const sendMessage = useEventCallback(handleSend);

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
            setActiveTab((prev) => {
              const next = prev === 'editor' ? 'preview' : 'editor';
              setSurface(next === 'preview' ? 'preview' : 'code');
              return next;
            });
            break;
          case 'enhance-ui':
            if (id) {
              vfs.enhanceUi(id).then(() => {
                toast(queuedJobsEnabled ? 'UI candidate prepared. Review the staged changes.' : 'UI enhancement applied!', 'success');
                setPreviewKey((k) => k + 1);
              }).catch((err: any) => toast(err.message || 'Enhancement failed', 'error'));
            }
            break;
          case 'run-autofix': {
            const errorCtx = vfs.runtimeError;
            if (errorCtx) {
              const autoFixPrompt = `Fix runtime preview error: ${errorCtx.message}${errorCtx.path ? ` in file ${errorCtx.path}` : ''}${errorCtx.line ? ` at line ${errorCtx.line}` : ''}`;
              sendMessage(undefined, autoFixPrompt);
            } else {
              toast('No runtime errors detected to fix', 'info');
            }
            break;
          }
          case 'deploy-github':
            onDeploy?.('github');
            break;
          case 'export-zip':
            onDeploy?.('zip');
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
        sendMessage(undefined, action.prompt);
        break;
    }
  }, [files, id, vfs, toast, sendMessage, selectFileAndOpenTab, onDeploy]);

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
  }, [codegen.progress.status, id, toast]);

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

  // Keep a late project response from replacing the current workspace.
  useEffect(() => {
    if (!id || !token) return;
    let cancelled=false;
    const controller=new AbortController();
    const BASE_URL=import.meta.env.VITE_API_URL ?? '';
    setLoadingWorkspace(true); setWorkspaceError('');
    async function load() {
      try {
        const bp=await fetchBlueprint(id!);
        if(cancelled)return;
        if(!bp.isOwner)throw new Error('Only the project owner can edit this workspace. Open its blueprint from the gallery to view it.');
        setAppName(bp.appName);setBlueprint(bp);
        let nextFiles=await fetchBlueprintFilesWithContent(id!);
        if(cancelled)return;
        if(!nextFiles.length){
          const response=await fetch(`${BASE_URL}/api/blueprints/${id}/vfs/init`,{method:'POST',headers:{Authorization:`Bearer ${token}`},signal:controller.signal});
          if(!response.ok)throw new Error('Could not initialize workspace files.');
          const data=await response.json();nextFiles=data.data?.files || [];
        }
        if(cancelled)return;
        setFiles(nextFiles);
        const first=nextFiles.find(file=>file.path!=='preview.html' && /\.tsx?$/.test(file.path)) || nextFiles.find(file=>file.path!=='preview.html') || null;
        setSelectedFile(first);if(first)openFileTab(first.path);
        void loadVFS(id!);
        const chat=await fetch(`${BASE_URL}/api/auth/chat/${id}`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal});
        if(chat.ok){const data=await chat.json();if(!cancelled && data.success)setMessages(data.data.map((message:ChatMessage)=>({role:message.role,content:message.content, thinkingSteps:message.thinkingSteps, telemetry:message.telemetry, error:message.error})));}
      }catch(error){if(!cancelled)setWorkspaceError(error instanceof Error?error.message:'Could not load this workspace.');}
      finally{if(!cancelled)setLoadingWorkspace(false);}
    }
    void load();
    return ()=>{cancelled=true;controller.abort();};
  }, [id,token,loadVFS,loadAttempt,openFileTab]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const followConversation = useRef(true);
  const isSendingRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'auto',
      });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, []);

  useEffect(() => {
    if (followConversation.current) scrollToBottom();
  }, [messages, liveThinkingSteps, isThinking, scrollToBottom]);

  useEffect(() => {
    if (surface === 'agent' && followConversation.current) scrollToBottom();
  }, [surface, scrollToBottom]);

  async function handleSend(e?: React.FormEvent, overridePrompt?: string, resumeRunId?: string) {
    if (e) e.preventDefault();
    const userMessage = (overridePrompt ?? prompt).trim();
    if (!userMessage || isThinking || isSendingRef.current || vfs.isAgentExecuting || !id || !token) return;

    isSendingRef.current = true;
    followConversation.current = true;
    runTelemetry.current = {};
    setPlan('');
    setPipelineHeartbeat(null);
    setActivePipelineStage('INGESTION');
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
            runTelemetry.current.planner = { modelUsed, executionTimeMs, wasFallback };
          }
        },
        onPlan: (newPlan) => {
          if (Array.isArray(newPlan)) {
            setPlan(newPlan.map((s: string) => `- [ ] ${s}`).join('\n'));
          }
        },
        onPatch: (payload) => {
          const { filePath, content, modelUsed, executionTimeMs, wasFallback } = payload;
          if (modelUsed && filePath) {
            runTelemetry.current.patches = [...(runTelemetry.current.patches || []).filter(patch => patch.filePath !== filePath), { filePath, modelUsed, executionTimeMs, wasFallback }];
          }
          if (filePath && content) {
            const origContent = files.find(f => f.path === filePath)?.content || '';
            if (origContent.length > 200 && content.length < 100) {
              console.warn(`[AgentPage] Refusing to stage corrupt patch (<100 chars) for ${filePath}`);
              toast(`Skipped suspicious patch for ${filePath} (content too short to safely diff)`, 'info');
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
              toast(`Skipped suspicious diff for ${path} (content too short to safely diff)`, 'info');
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
              telemetry: doneTelemetry || { ...runTelemetry.current },
            },
          ]);
          if (newPlan) setPlan(Array.isArray(newPlan) ? newPlan.join('\n') : newPlan);

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
            { role: 'assistant', error: true, content: errMsg, thinkingSteps: [...collectedSteps], model: agentModel },
          ]);
          toast(errMsg, 'error');
        },
      }, resumeRunId);
    } catch (err: any) {
      setLiveThinkingSteps([]);
      setPipelineHeartbeat(null);
      const msg = err.message || 'Failed to connect to agent';
      setMessages(prev => [
        ...prev,
        { role: 'assistant', error: true, content: msg, model: agentModel },
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
        sendMessage(undefined, autoFixPrompt);
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
  }, [files, selectedFile, toast, isThinking, sendMessage, triggerPatchFlash]);

  // ─── Dev Test Diff Trigger: instantly verifies inline diff visuals ─────────
  const handleTestDiff = useCallback(() => {
    if (!selectedFile) {
      toast('Select a file first to test the inline diff', 'info');
      return;
    }
    const testAddition = '\n// Test Green Addition Line — delete after verifying inline diff visuals';
    setPendingDiff({
      filePath: selectedFile.path,
      original: selectedFile.content,
      modified: selectedFile.content + testAddition,
    });
    setDiffKey((k) => k + 1);
    setActiveTab('editor');
    toast('Test diff staged — verify green/red highlights below', 'info');
  }, [selectedFile, toast]);

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
      setSelectedFile((prev) => (prev?.path === targetPath ? { ...prev, content: targetContent } : prev));
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
    if (pendingDiff?.filePath) vfs.rejectDiff(pendingDiff.filePath);
    setPendingDiff(null);
    toast('Proposed AI changes discarded', 'info');
  }, [pendingDiff, vfs, toast]);

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
  const previewFiles = useMemo(() => {
    const current = Object.fromEntries(files.map(file => [file.path, file.content]));
    for (const [path, diff] of Object.entries(vfs.stagedDiffs)) {
      current[path] = diff.incomingCode;
    }
    return current;
  }, [files, vfs.stagedDiffs]);

  // ── Workspace selector ────────────────────────────────────────────────────
  if (!id) {
    return (
      <section className="workspace-selector" aria-labelledby="workspace-selector-title">
        <div className="workspace-selector-toolbar">
          <button type="button" onClick={() => navigate('/gallery')} className="workspace-selector-back">
            <ArrowLeft size={14} aria-hidden="true" />
            Back to Gallery
          </button>
          <span>YOUR WORKSPACE</span>
        </div>

        <header className="workspace-selector-heading">
          <div className="workspace-selector-mark"><Cpu size={28} aria-hidden="true" /></div>
          <h1 id="workspace-selector-title">Cortex Agent Workspace</h1>
          <p>Select a project to plan, edit files, and build with AI.</p>
        </header>

        {loadingWorkspaces ? (
          <div className="workspace-selector-state" role="status">
            <Loader2 className="animate-spin" size={24} aria-hidden="true" />
            <p>Loading workspaces…</p>
          </div>
        ) : workspaces.length === 0 ? (
          <div className="workspace-selector-state workspace-selector-empty">
            <p>You don't have any blueprints yet.</p>
            <Button onClick={() => navigate('/create')}>Build your first app</Button>
          </div>
        ) : (
          <div className="workspace-selector-grid">
            {workspaces.map((w, index) => (
              <motion.button type="button" key={w.id} onClick={() => navigate(`/agent/${w.id}`)} className="workspace-selector-card"
                initial={reducedMotion ? false : { opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ duration: reducedMotion ? 0 : 0.35, delay: reducedMotion ? 0 : (index % 2) * 0.045 }}
              >
                <span className="workspace-selector-avatar" aria-hidden="true">{w.appName?.[0]?.toUpperCase() || 'A'}</span>
                <span className="workspace-selector-card-content">
                  <strong>{w.appName}</strong>
                  <span className="workspace-selector-description">{w.idea}</span>
                  <span className="workspace-selector-open">Open workspace <span aria-hidden="true">↗</span></span>
                </span>
              </motion.button>
            ))}
          </div>
        )}
      </section>
    );
  }

  if(workspaceError) return <div className="route-loading" role="alert"><h1>Couldn’t open this workspace</h1><p>{workspaceError}</p><Button onClick={()=>setLoadAttempt(value=>value+1)}>Try again</Button><Button variant="ghost" onClick={()=>navigate(`/blueprint/${id}`)}>View blueprint</Button></div>;

  // ── Active workspace: Studio 3-Column Layout ─────────────────────────────
  return (
    <div className="agent-workspace w-full h-full overflow-hidden flex flex-col text-white relative font-sans">
      <nav className="agent-mobile-panels" aria-label="Workspace panels">{(['files','code','preview','agent'] as const).map(view => <button type="button" key={view} aria-pressed={surface === view} onClick={() => { setSurface(view); if(view === 'code' || view === 'preview') setActiveTab(view === 'code' ? 'editor' : 'preview'); }}>{view}</button>)}</nav>
      {/* ── Flex Workspace Wrapper ── */}
      <div className="workspace-panels flex-1 min-h-0 w-full flex overflow-hidden relative z-10" data-surface={surface} style={{'--files-width':`${fileWidth}px`,'--agent-width':`${agentWidth}px`} as React.CSSProperties}>

        {/* ── 1. Workspace File Tree Column ────────────── */}
        {/* ── 1. Workspace File Tree (240px, clean glassmorphic IDE layout) ── */}
        <aside className="workspace-files shrink-0 h-full border-r border-white/10 flex flex-col min-h-0">
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

        <PanelResizeHandle label="Resize files panel" value={fileWidth} min={170} max={320} onChange={setFileWidth}/>
        {/* ── 2. Center Code Editor (w-0 flex-1 — absorbs all remaining space) ── */}
        <main className="workspace-editor flex-1 w-0 min-w-0 h-full relative overflow-hidden flex flex-col">

        {/* Tab Bar Header */}
        <div className="agent-editor-toolbar">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => navigate('/agent')} className="agent-project-switch" title="Back to workspaces" aria-label={`Switch workspace, current project ${appName || 'Workspace'}`}><ArrowLeft size={13} /><strong>{appName || 'Workspace'}</strong></button>
            <SegmentedControl
              ariaLabel="Workspace view"
              value={activeTab}
              onChange={(v) => {setActiveTab(v);setSurface(v==='editor'?'code':'preview');}}
              options={[
                { value: 'editor', label: 'Code', icon: <FileCode size={12} /> },
                { value: 'preview', label: 'Preview', icon: <PlayCircle size={12} /> },
              ]}
            />
          </div>

          {selectedFile && activeTab === 'editor' && (
            <div className="flex items-center gap-2 font-sans text-[11px] text-gray-400 truncate min-w-0 tracking-tight">
              <button
                onClick={() => setIsPaletteOpen(true)}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg border border-white/10 bg-white/[0.03] text-gray-500 hover:text-white hover:border-indigo-500/30 hover:bg-indigo-500/10 text-[10px] font-sans transition-all shrink-0"
                title="Search files (⌘K)"
              >
                <Search size={10} />
                <span className="hidden lg:inline">⌘K</span>
              </button>
              {/* Dev-only diff fixture */}
              {import.meta.env.DEV && <button
                type="button"
                onClick={handleTestDiff}
                className="agent-dev-control"
                title="Test diff visuals with a sample addition"
              >
                <FlaskConical size={10} />
                <span className="hidden lg:inline">Test Diff</span>
              </button>}
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
                      ? 'bg-[#0A0A0B] text-white border-b-2 border-b-indigo-500'
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
              <div className="h-full flex flex-col min-h-0 relative diff-sweep-once">
                {/* Floating Diff Review Action Bar */}
                <div className="workspace-diff-actions z-20 flex items-center justify-between px-4 py-2 bg-[#18181B] border-b border-white/10 text-zinc-300 text-xs shrink-0 shadow-sm">
                  <div className="flex items-center gap-2 font-sans">
                    <GitCompare size={14} className="text-[#8F8FF7] shrink-0" />
                    <span>
                      AI Diff Review Mode — <strong className="text-white font-mono">{selectedFile.path}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="success" size="sm" onClick={handleAcceptDiff} icon={<CheckCircle2 size={13} />} title="Accept Changes (⌘+Enter)">
                      Accept Changes <kbd className="text-[10px] opacity-60 font-mono ml-1">⌘Enter</kbd>
                    </Button>
                    <Button variant="danger" size="sm" onClick={handleRejectDiff} icon={<XCircle size={13} />} title="Reject (Esc)">
                      Reject <kbd className="text-[10px] opacity-60 font-mono ml-1">Esc</kbd>
                    </Button>
                  </div>
                </div>

                {/* CodeMirror 6 Unified Merge View Engine - Raw DOM Mount */}
                <div
                  key={`diff-${selectedFile.path}-${diffKey}`}
                  ref={diffContainerRef}
                  className="flex-1 overflow-auto relative min-h-0 bg-[#0A0A0B] [&>.cm-editor]:h-full [&>.cm-editor]:text-xs [&>.cm-editor]:font-mono"
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
                    fileSave.schedule(path,val);
                    setTabDirtyState(prev=>({...prev,[path]:true}));
                  }}
                  className="h-full text-xs font-mono"
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-xs gap-2 font-sans">
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
                return sendMessage(undefined, p);
              }}
            />
          </div>
        </div>
          {/* ── IDE status bar — one calm mono readout ── */}
          {selectedFile && <div className="workspace-save" role="status"><span>{fileSave.states[selectedFile.path]==='error'?'Save failed — your edits are still in this workspace':fileSave.states[selectedFile.path]==='saving'?'Saving changes…':fileSave.states[selectedFile.path]==='pending'?'Unsaved changes':'All changes saved'}</span>{fileSave.states[selectedFile.path]==='error' && <button onClick={()=>fileSave.retry(selectedFile.path)}>Retry save</button>}</div>}
          {activeTab === 'editor' && (
            <div className="h-7 shrink-0 flex items-center justify-between px-3 border-t border-white/[0.06] bg-[#0A0A0B] font-mono text-[10px] text-zinc-600 tracking-wider select-none">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${isThinking ? 'bg-[#8F8FF7] animate-pulse' : 'bg-zinc-700'}`} />
                  {isThinking ? 'CORTEX · THINKING' : 'CORTEX · IDLE'}
                </span>
                {selectedFile && <span className="text-zinc-500">{selectedFile.path}</span>}
              </div>
              <div className="flex items-center gap-3">
                {pipelineHeartbeat && (
                  <span className="text-zinc-500">{pipelineHeartbeat.activeStage} · {(pipelineHeartbeat.elapsedMs / 1000).toFixed(0)}s</span>
                )}
                <span>{visibleFiles.length} files</span>
              </div>
            </div>
          )}

      </main>

      <PanelResizeHandle label="Resize agent panel" value={agentWidth} min={280} max={440} onChange={setAgentWidth} reverse/>
      {/* ── 3. Cortex Agent Right Panel (w-80 shrink-0 — always visible) ── */}
      <aside className="workspace-agent shrink-0 h-full overflow-hidden border-l border-white/10 z-10 flex flex-col min-h-0">

        <div className="agent-chat-header"><div><Cpu size={15} /><strong>Project agent</strong></div><span>{isThinking ? 'Working' : 'Ready'}</span></div>
        <div ref={chatScrollRef} className="agent-conversation" onScroll={(event) => { const el = event.currentTarget; followConversation.current = el.scrollHeight - el.scrollTop - el.clientHeight < 64; }} aria-label="Conversation">
          {id && <AgentRunHistory blueprintId={id} onResume={(runId, text) => void handleSend(undefined, text, runId)} />}
          {messages.length === 0 && !isThinking && <div className="agent-chat-empty"><span><Cpu size={22} /></span><h2>Build on your idea.</h2><p>Ask for a feature, a fix, or a second look at your code.</p></div>}
          {messages.map((message, index) => <AgentMessage key={index} message={message} />)}
          {isThinking && <AgentRunStatus stage={activePipelineStage} elapsedMs={pipelineHeartbeat?.elapsedMs} model={pipelineHeartbeat?.activeModel} steps={liveThinkingSteps} plan={plan} />}
          {!isThinking && plan && <details className="agent-run-details agent-latest-plan"><summary><ChevronRight size={12} /> Latest plan</summary><pre>{plan}</pre></details>}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSend} className="agent-chat-compose">
          <div className="agent-chat-input">
            <textarea rows={2} value={prompt} onChange={event => setPrompt(event.target.value)} aria-label="Message the project agent" placeholder={isThinking ? 'Working on your request…' : 'Ask for a change…'} disabled={isThinking}
              onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void handleSend(event); } }} />
            {isThinking ? (
              <button type="button" aria-label="Stop request" onClick={() => vfs.cancelAgentStream()}>Stop</button>
            ) : (
              <button type="submit" aria-label="Send message" disabled={!prompt.trim()}><Send size={15} /></button>
            )}
          </div>
          <div className="agent-compose-hint"><span>Enter to send · Shift + Enter for a new line</span></div>
        </form>

      </aside>

      </div>

      {/* Command Palette (Cmd+K) */}
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onAction={handlePaletteAction}
        scope="agent"
        filePaths={visibleFiles.map(f => f.path)}
        appName={appName}
        isAgentBusy={isThinking}
      />
    </div>
  );
}
