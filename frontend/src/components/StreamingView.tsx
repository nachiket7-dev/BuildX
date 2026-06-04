import { useEffect, useRef } from 'react';
import type { PartialBlueprint } from '../lib/types';
import { useModel, AVAILABLE_MODELS } from '../hooks/useModel';
import type { AgentEvent } from '../hooks/useStreamBlueprint';
import { FileText, Database, Webhook, Palette, Code, ShieldCheck } from 'lucide-react';
import { SpotlightCard } from './SpotlightCard';
import { StreamingSections } from './StreamingSections';

interface StreamingViewProps {
  progress: number;
  partialBlueprint: PartialBlueprint;
  agentEvents?: AgentEvent[];
}

const AGENTS_LIST = [
  { key: 'pm' as const, label: 'Product Manager', icon: FileText, color: 'text-blue-400', desc: 'Specs & Features' },
  { key: 'architect' as const, label: 'Database Architect', icon: Database, color: 'text-purple-400', desc: 'SQL Relations' },
  { key: 'api_dev' as const, label: 'API Developer', icon: Webhook, color: 'text-amber-400', desc: 'REST Endpoints' },
  { key: 'designer' as const, label: 'UI/UX Designer', icon: Palette, color: 'text-pink-400', desc: 'Screen Layouts' },
  { key: 'coder' as const, label: 'Developer', icon: Code, color: 'text-emerald-400', desc: 'Workspace Code' },
  { key: 'qa' as const, label: 'QA Evaluator', icon: ShieldCheck, color: 'text-cyan-400', desc: 'Integrity Check' },
] as const;

export function StreamingView({ progress, partialBlueprint, agentEvents = [] }: StreamingViewProps) {
  const { selectedModel } = useModel();
  const modelLabel = AVAILABLE_MODELS.find((m) => m.id === selectedModel)?.label || 'AI Model';
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentEvents]);

  const getAgentStatus = (agentKey: string) => {
    const events = agentEvents.filter((e) => e.agent === agentKey);
    if (events.length === 0) return 'idle';
    return events[events.length - 1].status;
  };

  return (
    <section
      className="flex-1 flex flex-col items-center justify-start px-4 sm:px-6 py-10 max-w-5xl mx-auto w-full"
      aria-live="polite"
      aria-busy="true"
      aria-label="Generating blueprint"
    >
      <div className="text-center mb-8 max-w-xl">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full border font-mono-custom text-xs mb-3"
          style={{
            borderColor: 'rgba(20, 184, 166, 0.25)',
            background: 'var(--accent-glow)',
            color: 'var(--accent2)',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: 'var(--accent)' }} />
          Multi-agent compilation
        </div>
        <h2 className="font-display font-extrabold text-2xl sm:text-3xl bg-gradient-to-r from-purple-400 via-indigo-200 to-green-400 bg-clip-text text-transparent mb-2">
          {partialBlueprint.appName
            ? `Building ${partialBlueprint.appName}`
            : 'Architecting your workspace…'}
        </h2>
        <p className="font-mono-custom text-xs" style={{ color: 'var(--text3)' }}>
          {AGENTS_LIST.length} agents · {modelLabel}
        </p>
      </div>

      <div className="w-full max-w-3xl mb-6">
        <div className="flex justify-between items-end mb-2 font-mono-custom text-xs" style={{ color: 'var(--text3)' }}>
          <span>Compilation progress</span>
          <span style={{ color: 'var(--text)' }}>{progress}%</span>
        </div>
        <div
          className="w-full h-2.5 rounded-full overflow-hidden"
          style={{ background: 'var(--surface3)', border: '1px solid var(--border)' }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full transition-all duration-500 ease-out progress-bar-glow"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, var(--accent-hex), var(--green))',
            }}
          />
        </div>
      </div>

      <StreamingSections partial={partialBlueprint} />

      <div className="w-full max-w-4xl grid grid-cols-2 md:grid-cols-6 gap-3 mb-8">
        {AGENTS_LIST.map((agent) => {
          const status = getAgentStatus(agent.key);
          const isActive = status === 'thinking' || status === 'writing' || status === 'correcting';
          const isCompleted = status === 'completed';
          const Icon = agent.icon;

          return (
            <SpotlightCard
              key={agent.key}
              spotlightColor={
                isCompleted
                  ? 'rgba(34, 197, 94, 0.08)'
                  : isActive
                    ? 'rgba(20, 184, 166, 0.12)'
                    : 'rgba(255, 255, 255, 0.03)'
              }
              className="p-4 rounded-xl text-center relative overflow-hidden transition-all duration-300"
              style={{
                borderColor: isCompleted
                  ? 'rgba(34, 197, 94, 0.25)'
                  : isActive
                    ? 'rgba(20, 184, 166, 0.35)'
                    : 'var(--border)',
                background: isCompleted
                  ? 'var(--green-dim)'
                  : isActive
                    ? 'var(--accent-glow)'
                    : 'var(--surface)',
              }}
            >
              {isActive && (
                <span className="absolute top-2 right-2 flex h-2 w-2" aria-hidden>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--accent)' }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: 'var(--accent-hex)' }} />
                </span>
              )}
              {isCompleted && (
                <span className="absolute top-2 right-2 text-[10px]" style={{ color: 'var(--green)' }} aria-hidden>
                  ✓
                </span>
              )}

              <div
                className={`flex justify-center mb-2 transition-all ${!isActive && !isCompleted ? 'opacity-40 grayscale' : ''}`}
              >
                <Icon size={24} className={agent.color} />
              </div>
              <div className="font-display font-semibold text-xs mb-0.5 truncate" style={{ color: 'var(--text)' }}>
                {agent.label}
              </div>
              <div className="font-mono-custom text-[9px] truncate" style={{ color: 'var(--text3)' }}>
                {status === 'correcting' ? 'Fixing' : status === 'idle' ? 'Waiting' : status}
              </div>
            </SpotlightCard>
          );
        })}
      </div>

      <div
        className="w-full max-w-4xl rounded-xl overflow-hidden flex flex-col h-[300px] sm:h-[320px]"
        style={{
          border: '1px solid var(--border2)',
          background: 'rgba(0, 0, 0, 0.92)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
        }}
      >
        <div
          className="px-4 py-2.5 flex items-center justify-between"
          style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-1.5" aria-hidden>
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
          </div>
          <span className="font-mono-custom text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
            Agent console
          </span>
          <div className="w-10" />
        </div>

        <div
          className="flex-1 p-4 overflow-y-auto font-mono-custom text-xs space-y-2.5"
          style={{ color: 'var(--green)' }}
        >
          <div style={{ color: 'var(--text3)' }}>[SYS] Connection established · SSE stream active</div>

          {agentEvents.map((evt, idx) => {
            const agentLabel = evt.agent.toUpperCase();
            let color = 'var(--accent2)';
            if (evt.status === 'completed') color = 'var(--green)';
            if (evt.status === 'correcting') color = 'var(--amber)';

            return (
              <div key={idx} className="flex items-start gap-2 animate-fade-in leading-relaxed">
                <span className="shrink-0 select-none" style={{ color: 'var(--text3)' }}>
                  [{evt.timestamp}]
                </span>
                <span className="font-semibold shrink-0 select-none" style={{ color }}>
                  [{agentLabel}]
                </span>
                <span style={{ color: 'var(--text)' }}>{evt.log || evt.message}</span>
              </div>
            );
          })}

          <div className="flex items-center gap-1">
            <span style={{ color: 'var(--text3)' }}>[{new Date().toLocaleTimeString()}]</span>
            <span className="font-semibold" style={{ color: 'var(--green)' }}>
              [SYSTEM]
            </span>
            <span style={{ color: 'var(--text)' }}>Compiling…</span>
            <span className="terminal-cursor" aria-hidden />
          </div>

          <div ref={terminalEndRef} />
        </div>
      </div>
    </section>
  );
}
