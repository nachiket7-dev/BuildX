import React from 'react';
import { ShinyText } from './ShinyText';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: { box: 'w-8 h-8', svg: 'w-4 h-4', text: 'text-lg', badge: 'text-[9px] px-1.5 py-0.5' },
  md: { box: 'w-9 h-9', svg: 'w-5 h-5', text: 'text-xl sm:text-2xl', badge: 'text-[10px] px-2.5 py-0.5' },
  lg: { box: 'w-11 h-11', svg: 'w-6 h-6', text: 'text-2xl sm:text-3xl', badge: 'text-[11px] px-3 py-0.5' },
};

export function Logo({ size = 'md' }: LogoProps) {
  const s = sizes[size];
  return (
    <div className="flex items-center gap-2.5 group cursor-pointer select-none">
      <div
        className={`${s.box} rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3`}
        style={{
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          boxShadow: '0 0 16px rgba(99, 102, 241, 0.15)',
        }}
      >
        <svg className={s.svg} viewBox="0 0 24 24" fill="none">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="rgba(129,140,248,0.9)" stroke="rgba(165,180,252,0.6)" strokeWidth="0.5" />
        </svg>
      </div>
      <ShinyText
        text="BuildX"
        className={`${s.text} font-display font-extrabold tracking-tight text-white`}
        speed={4}
      />
      <span
        className={`${s.badge} hidden sm:inline-block font-mono rounded-full border border-indigo-500/20 bg-indigo-500/8 text-indigo-400 font-medium tracking-wider`}
      >
        AI ARCHITECT
      </span>
    </div>
  );
}
