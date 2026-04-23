import React from 'react';
import type { PartialBlueprint } from '../lib/types';

interface StreamingViewProps {
  progress: number;
  partialBlueprint: PartialBlueprint;
}

const STEPS = [
  { key: 'appName', label: 'Identifying app name & concept' },
  { key: 'features', label: 'Breaking down feature categories' },
  { key: 'schema', label: 'Designing database schema' },
  { key: 'endpoints', label: 'Mapping API endpoints' },
  { key: 'screens', label: 'Structuring UI screens' },
  { key: 'architecture', label: 'Defining architecture & stack' },
  { key: 'code', label: 'Generating starter code' },
  { key: 'effort', label: 'Computing effort estimation' },
] as const;

type StepStatus = 'pending' | 'active' | 'done';

function getStepStatus(
  key: string,
  partial: PartialBlueprint,
  progress: number
): StepStatus {
  const val = (partial as Record<string, unknown>)[key];
  if (val !== undefined) return 'done';

  // Find the index of this step
  const idx = STEPS.findIndex((s) => s.key === key);
  const prevKey = idx > 0 ? STEPS[idx - 1].key : null;
  const prevDone =
    prevKey === null || (partial as Record<string, unknown>)[prevKey] !== undefined;

  if (prevDone && progress > 0) return 'active';
  return 'pending';
}

export function StreamingView({ progress, partialBlueprint }: StreamingViewProps) {
  const appName = partialBlueprint.appName;

  return (
    <section className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        {/* Animated logo */}
        <div className="flex justify-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{
              background: 'var(--accent)',
              animation: 'breathe 2s ease-in-out infinite',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
        </div>

        <h2
          className="font-display font-bold text-2xl text-center mb-2"
          style={{ color: 'var(--text)' }}
        >
          {appName ? `Building ${appName}...` : 'Architecting your app...'}
        </h2>
        <p
          className="font-mono-custom text-sm text-center mb-4"
          style={{ color: 'var(--text3)' }}
        >
          Streaming from Llama 3.3 70B
        </p>

        {/* Real progress bar */}
        <div className="mb-8">
          <div
            className="w-full h-1.5 rounded-full overflow-hidden"
            style={{ background: 'var(--surface3)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, var(--accent), var(--green))',
                boxShadow: '0 0 12px var(--accent-glow)',
              }}
            />
          </div>
          <div
            className="font-mono-custom text-xs text-right mt-1.5"
            style={{ color: 'var(--text3)' }}
          >
            {progress}%
          </div>
        </div>

        {/* Steps */}
        <div className="flex flex-col gap-2.5">
          {STEPS.map(({ key, label }) => {
            const status = getStepStatus(key, partialBlueprint, progress);
            return (
              <div
                key={key}
                className="flex items-center gap-3 px-4 py-3 rounded-[10px] border transition-all duration-500"
                style={{
                  background:
                    status === 'done'
                      ? 'var(--green-dim)'
                      : status === 'active'
                      ? 'var(--accent-glow)'
                      : 'var(--surface)',
                  borderColor:
                    status === 'done'
                      ? 'rgba(34,211,165,0.2)'
                      : status === 'active'
                      ? 'rgba(124,106,255,0.3)'
                      : 'var(--border)',
                  color:
                    status === 'done'
                      ? 'var(--green)'
                      : status === 'active'
                      ? 'var(--text)'
                      : 'var(--text3)',
                }}
              >
                {/* Status indicator */}
                <div
                  className="flex-shrink-0 w-2 h-2 rounded-full transition-all duration-500"
                  style={{
                    background:
                      status === 'done'
                        ? 'var(--green)'
                        : status === 'active'
                        ? 'var(--accent)'
                        : 'var(--text3)',
                    boxShadow:
                      status === 'done'
                        ? '0 0 8px var(--green)'
                        : status === 'active'
                        ? '0 0 8px var(--accent)'
                        : 'none',
                    animation:
                      status === 'active'
                        ? 'pulse-dot 1s ease-in-out infinite'
                        : 'none',
                  }}
                />
                <span className="font-mono-custom text-xs">{label}</span>
                {status === 'done' && (
                  <svg
                    className="ml-auto flex-shrink-0"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
