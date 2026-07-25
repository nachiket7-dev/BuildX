import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { fetchBlueprintFilesWithContent, fetchBlueprint, fetchMyBlueprints } from '../lib/api';
import { PreviewPanel } from './PreviewPanel';
import { useCodeGeneration } from '../hooks/useCodeGeneration';
import {
  Wand2,
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

export function AgentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { toast } = useToast();

  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);

  // Active workspace state
  const [appName, setAppName] = useState<string>('');
  const [files, setFiles] = useState<VfsFile[]>([]);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [selectedFile, setSelectedFile] = useState<VfsFile | null>(null);
  const [activeTab, setActiveTab] = useState<'explorer' | 'editor' | 'preview'>('explorer');

  // Agent states
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [plan, setPlan] = useState<string>('');
  const [isThinking, setIsThinking] = useState(false);
  const [liveThinkingSteps, setLiveThinkingSteps] = useState<string[]>([]);
  const [previewKey, setPreviewKey] = useState(0);
  const [agentModel, setAgentModel] = useState<string>('nemotron-3-550b');
  const [expandedThinking, setExpandedThinking] = useState<Record<number, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    : 'Nemotron 550B';

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
        .then(bp => setAppName(bp.appName))
        .catch(() => {});

      fetchBlueprintFilesWithContent(id)
        .then(res => {
          setFiles(res);
          // Select first non-preview file
          const first = res.find(
            f => f.path !== 'preview.html' && (f.path.endsWith('.tsx') || f.path.endsWith('.ts'))
          ) || res.find(f => f.path !== 'preview.html') || null;
          setSelectedFile(first);
        })
        .catch(() => {});

      fetch(`${BASE_URL}/api/auth/chat/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(r => {
          if (r.success) {
            setMessages(r.data.map((m: any) => ({ role: m.role, content: m.content })));
          }
        })
        .catch(() => {})
        .finally(() => setLoadingWorkspace(false));
    }
  }, [id, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveThinkingSteps]);

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
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <Wand2 className="text-emerald-400" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">BuildX Code Agent</h1>
          <p className="text-gray-400 text-sm max-w-md">
            Select a project workspace to plan, edit files, and build code interactively with AI.
          </p>
        </div>

        {loadingWorkspaces ? (
          <div className="flex flex-col items-center gap-2 py-12">
            <Loader2 className="animate-spin text-emerald-400" size={24} />
            <span className="text-xs text-gray-500 font-mono-custom">Loading workspaces…</span>
          </div>
        ) : workspaces.length === 0 ? (
          <div className="text-center py-12 border border-white/5 bg-white/[0.02] rounded-2xl px-8 max-w-md w-full">
            <p className="text-sm text-gray-400 mb-4">You don't have any blueprints yet.</p>
            <button
              onClick={() => navigate('/create')}
              className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold rounded-xl transition-all"
            >
              Build your first app
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            {workspaces.map(w => (
              <button
                key={w.id}
                onClick={() => navigate(`/agent/${w.id}`)}
                className="flex items-start text-left p-5 bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-emerald-500/20 rounded-2xl transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-lg font-bold text-emerald-400 shrink-0 mr-4">
                  {w.appName?.[0]?.toUpperCase() || 'A'}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-white truncate">{w.appName}</h3>
                  <p className="text-xs text-gray-400 truncate mt-1">{w.idea}</p>
                  <span className="inline-block mt-3 text-[10px] font-mono-custom text-emerald-400 border border-emerald-500/10 px-2 py-0.5 rounded">
                    Open Workspace →
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Active workspace ──────────────────────────────────────────────────────
  const TAB_STYLES = {
    active: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/25',
    inactive: 'text-gray-400 hover:text-white hover:bg-white/[0.06] border border-transparent',
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-[calc(100vh-64px)] min-h-0 overflow-hidden bg-[#0d0d0f]">

      {/* ── Left column: Chat ──────────────────────────────────────────────── */}
      <div className="w-full md:w-[420px] flex flex-col min-h-0 border-r border-white/5 bg-[#111113]">

        {/* Header */}
        <div className="p-4 border-b border-white/5 flex flex-col gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/agent')}
              className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors shrink-0"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Wand2 size={13} className="text-emerald-400 shrink-0" />
                <span className="text-sm font-bold text-white">BuildX Code Agent</span>
              </div>
              {appName && (
                <span className="text-[10px] font-mono-custom text-gray-500 block mt-0.5 truncate">
                  Project: {appName}
                </span>
              )}
            </div>
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono-custom shrink-0 transition-all ${isThinking ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-gray-500'}`}>
              {isThinking && <Loader2 className="animate-spin text-emerald-400" size={10} />}
              <span>{isThinking ? 'Thinking…' : 'Idle'}</span>
            </div>
          </div>

          {/* Model selector */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-mono-custom uppercase tracking-widest text-gray-500 font-semibold">Model</span>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { mid: 'nemotron-3-550b',  label: 'Nemotron',   sub: '550B · NVIDIA', accent: 'emerald' },
                { mid: 'gemini-3.5-flash', label: 'Gemini 3.5', sub: 'Flash · Google', accent: 'blue' },
                { mid: 'gemini-3.1-pro',   label: 'Gemini 3.1', sub: 'Pro · Google',   accent: 'purple' },
              ] as const).map(m => {
                const active = agentModel === m.mid;
                const accentClass =
                  m.accent === 'emerald' ? (active ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : '')
                  : m.accent === 'blue'   ? (active ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'     : '')
                  : (active ? 'bg-purple-500/15 border-purple-500/30 text-purple-300' : '');
                return (
                  <button
                    key={m.mid}
                    onClick={() => setAgentModel(m.mid)}
                    className={`flex flex-col items-start px-2.5 py-2 rounded-xl border text-left transition-all ${
                      active ? accentClass : 'bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/[0.05] hover:text-white'
                    }`}
                  >
                    <span className={`text-[11px] font-semibold leading-tight ${active ? '' : 'text-gray-300'}`}>
                      {m.label}
                    </span>
                    <span className="text-[9px] font-mono-custom text-gray-500 mt-0.5 leading-tight">{m.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Plan checklist */}
        {plan && (
          <div className="p-3 border-b border-white/5 bg-emerald-500/[0.02] shrink-0">
            <div className="flex items-center gap-1.5 text-[10px] font-mono-custom text-emerald-400 uppercase tracking-widest font-semibold mb-1">
              <CheckSquare size={11} />
              <span>Task Checklist</span>
            </div>
            <pre className="text-xs text-gray-400 font-mono-custom whitespace-pre-wrap max-h-24 overflow-y-auto leading-relaxed">
              {plan}
            </pre>
          </div>
        )}

        {/* Chat history */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !isThinking && (
            <div className="text-center py-12 px-4">
              <Sparkles className="mx-auto text-emerald-400/30 mb-3" size={24} />
              <p className="text-xs text-gray-400 leading-relaxed font-mono-custom">
                Describe what you want to build or modify. The agent will plan, reason, and edit files live.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col max-w-[88%] rounded-2xl text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-purple-500/10 border border-purple-500/20 text-purple-200 self-end ml-auto p-3.5'
                  : 'bg-white/[0.03] border border-white/5 text-gray-300 self-start'
              }`}
            >
              {msg.role === 'user' ? (
                <>
                  <span className="font-mono-custom text-[9px] uppercase tracking-wider text-purple-400/60 mb-1 block">You</span>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </>
              ) : (
                <>
                  {/* Thinking block — collapsible */}
                  {msg.thinkingSteps && msg.thinkingSteps.length > 0 && (
                    <div className="border-b border-white/5 px-3.5 pt-3 pb-2">
                      <button
                        onClick={() =>
                          setExpandedThinking(prev => ({ ...prev, [i]: !prev[i] }))
                        }
                        className="flex items-center gap-1.5 text-[10px] font-mono-custom text-gray-500 hover:text-emerald-400 transition-colors w-full text-left"
                      >
                        <Brain size={10} className="text-emerald-500/60 shrink-0" />
                        <span className="uppercase tracking-widest font-semibold">
                          {modelLabel(msg.model ?? agentModel)} thought for {msg.thinkingSteps.length} step{msg.thinkingSteps.length !== 1 ? 's' : ''}
                        </span>
                        {expandedThinking[i] ? <ChevronDown size={10} className="ml-auto" /> : <ChevronRight size={10} className="ml-auto" />}
                      </button>
                      {expandedThinking[i] && (
                        <div className="mt-2 space-y-1 max-h-48 overflow-y-auto pr-1">
                          {msg.thinkingSteps.map((step, si) => (
                            <div key={si} className="text-[10px] font-mono-custom text-gray-500 leading-relaxed border-l-2 border-emerald-500/20 pl-2 py-0.5">
                              {step}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Assistant message */}
                  <div className="p-3.5">
                    <span className="font-mono-custom text-[9px] uppercase tracking-wider text-emerald-400/60 mb-1 block">
                      {modelLabel(msg.model ?? agentModel)}
                    </span>
                    <div className="whitespace-pre-wrap text-gray-300">{msg.content}</div>
                  </div>
                </>
              )}
            </div>
          ))}

          {/* Live thinking stream */}
          {isThinking && (
            <div className="self-start flex flex-col max-w-[88%] bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden text-xs">
              <div className="flex items-center gap-2 px-3.5 pt-3 pb-2 border-b border-white/5">
                <Loader2 className="animate-spin text-emerald-400 shrink-0" size={11} />
                <span className="font-mono-custom text-[10px] uppercase tracking-widest text-emerald-400 font-semibold">
                  {modelLabel(agentModel)} is thinking…
                </span>
              </div>
              <div className="p-3 space-y-1.5 max-h-48 overflow-y-auto">
                {liveThinkingSteps.length === 0 ? (
                  <div className="text-[10px] font-mono-custom text-gray-500 animate-pulse">Initializing…</div>
                ) : (
                  liveThinkingSteps.map((step, si) => (
                    <div
                      key={si}
                      className={`text-[10px] font-mono-custom leading-relaxed border-l-2 pl-2 py-0.5 transition-all ${
                        si === liveThinkingSteps.length - 1
                          ? 'border-emerald-400/60 text-emerald-300'
                          : 'border-emerald-500/20 text-gray-500'
                      }`}
                    >
                      {step}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Prompt input */}
        <form onSubmit={handleSend} className="p-3 border-t border-white/5 bg-[#0d0d0f] flex gap-2 shrink-0">
          <input
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            disabled={isThinking}
            placeholder="Describe what to build or change…"
            className="flex-1 bg-white/5 hover:bg-white/[0.07] focus:bg-white/[0.08] focus:ring-1 focus:ring-emerald-500/30 border border-white/5 focus:border-emerald-500/30 rounded-xl px-3 py-2 text-xs text-white outline-none placeholder-gray-600 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!prompt.trim() || isThinking}
            className="p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-all disabled:opacity-30"
          >
            <Send size={14} />
          </button>
        </form>
      </div>

      {/* ── Right column: Code Studio ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0c]">

        {/* Tab bar */}
        <div className="flex items-center gap-1.5 border-b border-white/5 px-4 h-12 shrink-0">
          {(
            [
              { key: 'explorer', label: 'Workspace Files', icon: <Folder size={13} /> },
              { key: 'editor',   label: 'Code Editor',     icon: <FileCode size={13} /> },
              { key: 'preview',  label: 'Live Preview',    icon: <PlayCircle size={13} /> },
            ] as const
          ).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === tab.key ? TAB_STYLES.active : TAB_STYLES.inactive
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab panels — all rendered simultaneously, toggled via display */}
        <div className="flex-1 overflow-hidden relative">

          {/* Explorer */}
          <div className={`absolute inset-0 overflow-y-auto p-4 ${activeTab === 'explorer' ? '' : 'hidden'}`}>
            {loadingWorkspace ? (
              <div className="flex items-center justify-center h-full gap-2 text-gray-500 text-xs">
                <Loader2 className="animate-spin text-emerald-400" size={16} />
                <span>Loading workspace VFS…</span>
              </div>
            ) : visibleFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-center max-w-lg mx-auto p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                <Terminal className="text-emerald-400/30 mb-4 animate-pulse" size={44} />
                <h3 className="text-sm font-bold text-white mb-2">Uninitialized VFS Workspace</h3>
                <p className="text-xs text-gray-400 leading-relaxed mb-6">
                  This workspace has no codebase files scaffolded yet. Initialize the React + Express full-stack codebase structure to enable live code editing and agent refinements.
                </p>

                {codegen.isGenerating ? (
                  <div className="w-full bg-[#0d0d0f] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between text-[11px] font-mono-custom">
                      <span className="text-emerald-400 font-semibold animate-pulse">Generating codebase scaffold…</span>
                      <span className="text-gray-500">
                        {codegen.progress.currentFileIndex} / {codegen.progress.totalFiles}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{
                          width: `${
                            codegen.progress.totalFiles > 0
                              ? (codegen.progress.currentFileIndex / codegen.progress.totalFiles) * 100
                              : 5
                          }%`,
                        }}
                      />
                    </div>

                    <div className="text-[10px] font-mono-custom text-gray-500 truncate text-left">
                      Writing: <span className="text-gray-300">{codegen.progress.currentFilePath || 'Connecting…'}</span>
                    </div>
                  </div>
                ) : codegen.progress.status === 'error' ? (
                  <div className="w-full bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl p-4 text-xs mb-4 text-left">
                    <p className="font-semibold mb-1">Scaffold generation failed:</p>
                    <p className="text-gray-400 font-mono-custom text-[11px] leading-relaxed mb-3">{codegen.progress.error || 'Connection error.'}</p>
                    <div className="text-[10px] text-gray-500 mb-4 bg-white/[0.02] p-2.5 rounded-lg border border-white/5 leading-relaxed">
                      💡 <strong>Tip:</strong> If you are using <strong>Nemotron</strong>, it can occasionally fail due to rate limits or timeouts. Switch the active model to <strong>Gemini 3.5 Flash</strong> in the sidebar and retry — it builds the 19+ scaffold files in 30 seconds instead of 10 minutes.
                    </div>
                    <button
                      onClick={() => codegen.generateCode(id, agentModel)}
                      className="w-full py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold transition-all"
                    >
                      Retry Scaffolding
                    </button>
                  </div>
                ) : (
                  <div className="w-full flex flex-col gap-3">
                    {agentModel.includes('nemotron') && (
                      <div className="text-[10px] text-gray-500 bg-white/[0.02] p-3 rounded-xl border border-white/5 leading-relaxed text-left">
                        ⚠️ <strong>Note:</strong> Initializing files using <strong>Nemotron 550B</strong> runs 19+ individual API calls and takes <strong>8 to 10 minutes</strong>. 
                        We highly recommend switching to <strong>Gemini 3.5 Flash</strong> (via the sidebar model selector) for a fast 30-second initialization.
                      </div>
                    )}
                    <button
                      onClick={() => codegen.generateCode(id, agentModel)}
                      className="w-full py-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2"
                    >
                      <Wand2 size={14} />
                      <span>Initialize Workspace Files</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {visibleFiles.map(file => (
                  <button
                    key={file.path}
                    onClick={() => {
                      setSelectedFile(file);
                      setActiveTab('editor');
                    }}
                    className={`flex items-center text-left p-3.5 border rounded-xl transition-all group ${
                      selectedFile?.path === file.path
                        ? 'bg-emerald-500/10 border-emerald-500/25'
                        : 'bg-white/[0.02] hover:bg-white/[0.04] border-white/5 hover:border-emerald-500/10'
                    }`}
                  >
                    <FileText
                      className={`shrink-0 mr-3 transition-colors ${
                        selectedFile?.path === file.path ? 'text-emerald-400' : 'text-emerald-400/40 group-hover:text-emerald-400'
                      }`}
                      size={16}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-mono-custom text-xs text-white truncate block">
                        {file.path.split('/').pop()}
                      </span>
                      <span className="font-mono-custom text-[10px] text-gray-500 truncate block mt-0.5">
                        {file.path}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Code Editor */}
          <div className={`absolute inset-0 flex flex-col overflow-hidden ${activeTab === 'editor' ? '' : 'hidden'}`}>
            {visibleFiles.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-xs p-6 text-center max-w-sm mx-auto">
                <Terminal size={24} className="opacity-30 mb-2" />
                <span>Initialize the VFS workspace files first to edit or view code.</span>
              </div>
            ) : selectedFile ? (
              <>
                <div className="px-4 py-2 border-b border-white/5 bg-white/[0.02] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileCode size={12} className="text-emerald-400 shrink-0" />
                    <span className="font-mono-custom text-xs text-gray-300 truncate">{selectedFile.path}</span>
                  </div>
                  <span className="font-mono-custom text-[10px] uppercase text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded shrink-0 ml-2">
                    {selectedFile.language}
                  </span>
                </div>
                <pre className="flex-1 overflow-auto p-4 text-xs font-mono-custom text-gray-300 bg-[#0a0a0c] leading-relaxed whitespace-pre select-text selection:bg-emerald-500/20">
                  {selectedFile.content}
                </pre>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-xs gap-2">
                <FileCode size={24} className="opacity-30" />
                <span>Select a file from the Workspace Files tab.</span>
              </div>
            )}
          </div>

          {/* Live Preview */}
          <div className={`absolute inset-0 overflow-y-auto p-4 ${activeTab === 'preview' ? '' : 'hidden'}`}>
            <PreviewPanel blueprintId={id} appName={appName} key={previewKey} />
          </div>
        </div>
      </div>
    </div>
  );
}
