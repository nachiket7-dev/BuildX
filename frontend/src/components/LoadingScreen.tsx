import React, { useEffect, useState } from 'react';

const STEPS = [
  'Analyzing idea & identifying core use case',
  'Breaking down feature categories',
  'Designing database schema & relationships',
  'Mapping REST API endpoints',
  'Structuring UI screens & components',
  'Defining system architecture & tech stack',
  'Generating real starter code',
  'Computing effort estimation',
];

type StepStatus = 'pending' | 'active' | 'done';

export function LoadingScreen() {
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(
    STEPS.map(() => 'pending')
  );

  useEffect(() => {
    let currentStep = 0;

    function advance() {
      if (currentStep >= STEPS.length) return;

      setStepStatuses((prev) => {
        const next = [...prev];
        // Mark previous as done
        if (currentStep > 0) next[currentStep - 1] = 'done';
        // Mark current as active
        next[currentStep] = 'active';
        return next;
      });

      currentStep++;
      // Stagger: faster at start, slower toward end
      const delay = 500 + Math.random() * 600;
      setTimeout(advance, delay);
    }

    advance();

    return () => {
      // Cleanup is handled by component unmount
    };
  }, []);

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
          Architecting your app...
        </h2>
        <p className="font-mono-custom text-sm text-center mb-10" style={{ color: 'var(--text3)' }}>
          This takes 20-40 seconds. Claude is thinking deeply.
        </p>

        {/* Steps */}
        <div className="flex flex-col gap-2.5">
          {STEPS.map((step, i) => {
            const status = stepStatuses[i];
            return (
              <div
                key={step}
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
                <div className="flex-shrink-0 w-2 h-2 rounded-full transition-all duration-500"
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
                    animation: status === 'active' ? 'pulse-dot 1s ease-in-out infinite' : 'none',
                  }}
                />
                <span className="font-mono-custom text-xs">{step}</span>
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
