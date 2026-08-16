import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { fetchBlueprintFilesWithContent, fetchBlueprint, fetchMyBlueprints } from '../lib/api';
import type { Blueprint } from '../lib/types';
import { PreviewPanel } from './PreviewPanel';
import { WorkspaceFileTree } from './WorkspaceFileTree';
import { useCodeGeneration } from '../hooks/useCodeGeneration';
import {
  Cpu,
  Folder,
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
  Settings,
  Zap,
  GitCompare,
  Wrench,
} from 'lucide-react';

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
}

type AppShellOutletContext = { sidebarOpen: boolean; onDeploy?: () => void };

export function AgentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { toast } = useToast();
  const { sidebarOpen } = useOutletContext<AppShellOutletContext>();

  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);

  // Active workspace state
  const [appName, setAppName] = useState<string>('');
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [files, setFiles] = useState<VfsFile[]>([]);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [selectedFile, setSelectedFile] = useState<VfsFile | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');

  // Agent states
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [plan, setPlan] = useState<string>('');
  const [isThinking, setIsThinking] = useState(false);
  const [liveThinkingSteps, setLiveThinkingSteps] = useState<string[]>([]);
  const [previewKey, setPreviewKey] = useState(0);
  const [agentModel, setAgentModel] = useState<string>('nemotron-3-550b');
  const [expandedThinking, setExpandedThinking] = useState<Record<number, boolean>>({});
  const codegen = useCodeGeneration();


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

  const modelLabel = (mid: string) =>
    mid === 'gemini-3.5-flash' ? 'Gemini 3.5 Flash'
    : mid === 'gemini-3.1-pro' ? 'Gemini 3.1 Pro'
    : 'Cortex (Nemotron 550B)';

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

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || isThinking || !id || !token) return;

    const userMessage = prompt.trim();
    setPrompt('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsThinking(true);
    setLiveThinkingSteps([]);

    let gotDone = false;

    try {
      const BASE_URL = import.meta.env.VITE_API_URL ?? '';
      const response = await fetch(`${BASE_URL}/api/agent/${id}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: userMessage, model: agentModel }),
      });

      if (!response.ok || !response.body) {
        const errBody = await response.text().catch(() => '');
        throw new Error(errBody || `Agent request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const collectedSteps: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let pendingEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            pendingEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const raw = line.slice(6).trim();
            try {
              const payload = JSON.parse(raw);

              if (pendingEvent === 'thinking') {
                const step: string = payload.step ?? '';
                collectedSteps.push(step);
                setLiveThinkingSteps(prev => [...prev, step]);

              } else if (pendingEvent === 'done') {
                gotDone = true;
                const { message, plan: newPlan, modifiedFiles } = payload;
                setLiveThinkingSteps([]);
                setMessages(prev => [
                  ...prev,
                  {
                    role: 'assistant',
                    content: message,
                    thinkingSteps: [...collectedSteps],
                    model: agentModel,
                  },
                ]);
                if (newPlan) setPlan(newPlan);

                // Reload workspace files
                const updated = await fetchBlueprintFilesWithContent(id);
                setFiles(updated);
                if (selectedFile) {
                  const refreshed = updated.find(f => f.path === selectedFile.path);
                  if (refreshed) setSelectedFile(refreshed);
                }
                setPreviewKey(k => k + 1);
                if (modifiedFiles?.length) {
                  toast(`Updated ${modifiedFiles.length} file(s) successfully!`, 'success');
                }

              } else if (pendingEvent === 'error') {
                // Show the backend error message in the chat, not just a toast
                const errMsg = payload.error || 'Agent encountered an error';
                setLiveThinkingSteps([]);
                setMessages(prev => [
                  ...prev,
                  { role: 'assistant', content: `⚠️ ${errMsg}`, thinkingSteps: [...collectedSteps], model: agentModel },
                ]);
                toast(errMsg, 'error');
                gotDone = true; // treat error as terminal
              }
            } catch {
              // ignore individual malformed SSE data lines
            }
          } else if (line === '') {
            pendingEvent = '';
          }
        }
      }

      // If stream ended without a done or error event (e.g. proxy timeout killed connection)
      if (!gotDone) {
        const msg = 'Connection closed before the agent finished. This usually means the request timed out. Try switching to Gemini 3.5 Flash for faster responses.';
        setLiveThinkingSteps([]);
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: `⚠️ ${msg}`, thinkingSteps: [...collectedSteps], model: agentModel },
        ]);
        toast(msg, 'error');
      }
    } catch (err: any) {
      setLiveThinkingSteps([]);
      const msg = err.message || 'Failed to connect to agent';
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `⚠️ ${msg}`, model: agentModel },
      ]);
      toast(msg, 'error');
    } finally {
      setIsThinking(false);
    }
  }

  const visibleFiles = files.filter(f => f.path !== 'preview.html');

  // ── Workspace selector ────────────────────────────────────────────────────
  if (!id) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-5xl mx-auto w-full">
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
            <span className="text-xs text-gray-500 font-mono-custom">Loading workspaces…</span>
          </div>
        ) : workspaces.length === 0 ? (
          <div className="text-center py-12 border border-white/5 bg-white/[0.02] rounded-2xl px-8 max-w-md w-full">
            <p className="text-sm text-gray-400 mb-4">You don't have any blueprints yet.</p>
            <button
              onClick={() => navigate('/create')}
              className="px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold rounded-xl transition-all"
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
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-lg font-bold text-indigo-400 shrink-0 mr-4 group-hover:scale-105 transition-transform">
                  {w.appName?.[0]?.toUpperCase() || 'A'}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-white truncate">{w.appName}</h3>
                  <p className="text-xs text-gray-400 truncate mt-1">{w.idea}</p>
                  <span className="inline-block mt-3 text-[10px] font-mono-custom text-indigo-400 border border-indigo-500/10 px-2 py-0.5 rounded">
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
  const TAB_STYLES = {
    active: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/25 shadow-sm',
    inactive: 'text-gray-400 hover:text-white hover:bg-white/[0.06] border border-transparent',
  };

  return (
    <div className="w-full h-full overflow-hidden flex flex-col bg-[#08080c] text-white relative selection:bg-purple-500 selection:text-white">
      {/* Top Ambient Mesh Light */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[250px] bg-emerald-500/10 blur-[150px] pointer-events-none rounded-full" />

      {/* ── Flex Workspace Wrapper ── */}
      <div className="flex-1 min-h-0 w-full flex overflow-hidden relative z-10 bg-[#08080c]">

        {/* ── 1. Workspace File Tree Column ────────────── */}
        {/* ── 1. Workspace File Tree (192px, never shrinks) ── */}
        <aside className="w-48 shrink-0 h-full border-r border-white/10 bg-[#08080c] flex flex-col overflow-y-auto custom-scrollbar">
          <div className="p-3 border-b border-white/5 flex items-center justify-between shrink-0 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <Folder size={14} className="text-purple-400" />
              <span className="text-xs font-bold text-white font-mono-custom">Workspace Files</span>
            </div>
            <span className="text-[10px] font-mono-custom text-gray-500 bg-white/5 px-2 py-0.5 rounded">
              {visibleFiles.length} files
            </span>
          </div>

          <WorkspaceFileTree
            files={files}
            activeFilePath={selectedFile?.path}
            onSelectFile={(path) => {
              const file = files.find(f => f.path === path);
              if (file) {
                setSelectedFile(file);
                setActiveTab('editor');
              }
            }}
            isLoading={loadingWorkspace}
          />
        </aside>

        {/* ── 2. Center Code Editor (w-0 flex-1 — absorbs all remaining space) ── */}
        <main className="flex-1 w-0 min-w-0 h-full relative overflow-hidden bg-[#08080c] flex flex-col">

        {/* Tab Bar Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-3 h-11 shrink-0 bg-white/[0.02]">
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

          {selectedFile && activeTab === 'editor' && (
            <div className="flex items-center gap-2 font-mono-custom text-[11px] text-gray-400 truncate min-w-0">
              <span className="text-gray-300 truncate">{selectedFile.path}</span>
              <span className="uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[9px] shrink-0">
                {selectedFile.language}
              </span>
            </div>
          )}
        </div>

        {/* Tab Panels */}
        <div className="flex-1 overflow-hidden relative min-w-0">

          {/* Code Editor */}
          <div className={`absolute inset-0 flex flex-col overflow-hidden ${activeTab === 'editor' ? '' : 'hidden'}`}>
            {visibleFiles.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-xs p-6 text-center max-w-sm mx-auto">
                <Terminal size={24} className="opacity-30 mb-2" />
                <span>Initialize the VFS workspace files first to edit or view code.</span>
              </div>
            ) : selectedFile ? (
              <pre className="flex-1 overflow-auto p-4 text-xs font-mono-custom text-gray-300 bg-[#08080a] leading-relaxed whitespace-pre select-text selection:bg-purple-500/20 min-w-0">
                {selectedFile.content}
              </pre>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-xs gap-2">
                <FileCode size={24} className="opacity-30" />
                <span>Select a file from the left sidebar or Overview.</span>
              </div>
            )}
          </div>

          {/* Live Preview */}
          <div className={`absolute inset-0 overflow-y-auto p-4 ${activeTab === 'preview' ? '' : 'hidden'}`}>
            <PreviewPanel
              blueprintId={id}
              appName={appName}
              layoutParadigm={blueprint?.layoutParadigm}
              productArchetype={blueprint?.productArchetype}
              primaryLandingScreenId={blueprint?.primaryLandingScreenId}
              key={previewKey}
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

            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono-custom shrink-0 transition-all ${isThinking ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-gray-500'}`}>
              {isThinking && <Loader2 className="animate-spin text-emerald-400" size={10} />}
              <span>{isThinking ? 'Thinking…' : 'Idle'}</span>
            </div>
          </div>

          {/* Multi-Model Telemetry Badges */}
          <div className="flex flex-col gap-1 p-2 rounded-lg bg-indigo-950/30 border border-indigo-500/20 text-[10px] font-mono-custom text-indigo-300">
            <div className="flex items-center justify-between font-semibold">
              <span>Pipeline Stage Telemetry</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                Active
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] text-gray-400 pt-1 border-t border-indigo-500/10">
              <div className="flex items-center gap-1">
                <Brain size={9} className="text-purple-400 shrink-0" />
                <span>PLAN: <span className="text-purple-300">Nemotron</span></span>
              </div>
              <div className="flex items-center gap-1">
                <Zap size={9} className="text-sky-400 shrink-0" />
                <span>INGEST: <span className="text-sky-300">Gemini 3.5</span></span>
              </div>
              <div className="flex items-center gap-1">
                <GitCompare size={9} className="text-emerald-400 shrink-0" />
                <span>DIFF: <span className="text-emerald-300">GLM-5.2</span></span>
              </div>
              <div className="flex items-center gap-1">
                <Wrench size={9} className="text-amber-400 shrink-0" />
                <span>FIX: <span className="text-amber-300 font-bold">Kimi K2.6</span></span>
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
                <div className="flex items-center gap-1.5 text-[10px] font-mono-custom text-emerald-400 uppercase tracking-widest font-semibold mb-1">
                  <CheckSquare size={11} />
                  <span>Task Checklist</span>
                </div>
                <pre className="text-[11px] text-gray-400 font-mono-custom whitespace-pre-wrap max-h-20 overflow-y-auto leading-relaxed">
                  {plan}
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Conversation Stream */}
        <div
          ref={chatScrollRef}
          className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 font-mono-custom text-xs chat-scroll-area scroll-smooth"
        >
          {messages.length === 0 && !isThinking && (
            <div className="text-center py-10 px-3">
              <Sparkles className="mx-auto text-indigo-400/40 mb-2 animate-pulse" size={20} />
              <p className="text-[11px] text-gray-400 leading-relaxed">
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
                        className="flex items-center gap-1.5 text-[10px] font-mono-custom text-gray-500 hover:text-emerald-400 transition-colors w-full text-left"
                      >
                        <Brain size={10} className="text-emerald-500/60 shrink-0" />
                        <span className="uppercase tracking-widest font-semibold">
                          Pipeline thought for {msg.thinkingSteps.length} step{msg.thinkingSteps.length !== 1 ? 's' : ''}
                        </span>
                        {expandedThinking[i] ? <ChevronDown size={10} className="ml-auto" /> : <ChevronRight size={10} className="ml-auto" />}
                      </button>
                      {expandedThinking[i] && (
                        <div className="mt-2 space-y-1 max-h-40 overflow-y-auto pr-1 font-mono-custom">
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
                    <span className="text-[9px] font-mono-custom uppercase tracking-wider text-emerald-400/70 mb-1 block">
                      {msg.model ? `Pipeline · ${msg.model}` : 'Pipeline · Cortex'}
                    </span>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </>
              ) : (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}
            </motion.div>
          ))}

          {isThinking && (
            <div className="self-start flex flex-col max-w-[92%] bg-white/[0.03] border border-white/5 rounded-xl p-2.5 text-[11px]">
              <div className="flex items-center gap-1.5 mb-1.5 text-emerald-400 font-semibold">
                <Loader2 className="animate-spin" size={12} />
                <span>Executing Pipeline…</span>
              </div>
              <div className="space-y-1">
                {liveThinkingSteps.map((step, idx) => (
                  <div key={idx} className="text-[10px] text-gray-400 border-l-2 border-emerald-500/30 pl-2 py-0.5">
                    {step}
                  </div>
                ))}
              </div>
            </div>
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
            className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-indigo-500/50 font-mono-custom"
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
    </div>
  );
}
