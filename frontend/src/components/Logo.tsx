import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: { box: 'w-7 h-7', svg: 'w-4 h-4', text: 'text-base', badge: 'text-[9px] px-1.5 py-0.5' },
  md: { box: 'w-9 h-9', svg: 'w-[18px] h-[18px]', text: 'text-lg', badge: 'text-[10px] px-2 py-0.5' },
  lg: { box: 'w-12 h-12', svg: 'w-6 h-6', text: 'text-2xl', badge: 'text-xs px-2.5 py-1' },
};

export function Logo({ size = 'md' }: LogoProps) {
  const s = sizes[size];
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`${s.box} rounded-[8px] flex items-center justify-center flex-shrink-0`}
        style={{ background: 'var(--accent)', boxShadow: '0 0 20px var(--accent-glow)' }}
      >
        <svg className={s.svg} viewBox="0 0 24 24" fill="white">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      </div>
      <span
        className={`${s.text} font-display font-bold tracking-tight`}
        style={{ color: 'var(--text)' }}
      >
        BuildX
      </span>
      <span
        className={`${s.badge} font-mono-custom rounded-full border`}
        style={{
          background: 'var(--accent-glow)',
          borderColor: 'rgba(124,106,255,0.3)',
          color: 'var(--accent2)',
          letterSpacing: '0.5px',
        }}
      >
        AI ARCHITECT
      </span>
    </div>
  );
}
