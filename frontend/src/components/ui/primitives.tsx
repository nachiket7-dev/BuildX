/**
 * BuildX UI Primitives — the single source of truth for app chrome styling.
 * Tokens: surfaces #0A0A0B / #111113 / #18181B / #1F1F23, accent #7C7CF4.
 * Typography: Inter (sans) for UI; JetBrains Mono only for data/kbd.
 * Radius: 8px controls (rounded-lg), 12px cards/panels (rounded-xl).
 */
import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

/* ─── Button ─────────────────────────────────────────────────────────────── */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
}

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-lg font-sans font-medium text-xs transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none select-none shrink-0';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-[#7C7CF4] text-[#0A0A0B] hover:bg-[#8F8FF7] active:bg-[#6464E8] font-semibold shadow-sm',
  secondary:
    'bg-[#18181B] text-zinc-300 border border-white/10 hover:bg-[#1F1F23] hover:text-white hover:border-white/20',
  ghost:
    'bg-transparent text-zinc-400 hover:text-white hover:bg-white/[0.06]',
  danger:
    'bg-red-500/10 text-red-300 border border-red-500/30 hover:bg-red-500/20 hover:border-red-500/40',
  success:
    'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/40',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-[11px]',
  md: 'px-3.5 py-2 text-xs',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
      {...props}
    >
      {icon && <span className="shrink-0 [&>svg]:block">{icon}</span>}
      {children}
    </button>
  );
});

/* ─── Card / Panel ───────────────────────────────────────────────────────── */

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl bg-[#111113] border border-white/[0.08] shadow-[0_4px_16px_rgba(0,0,0,0.25)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Panel({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg bg-[#18181B] border border-white/[0.06]', className)}
      {...props}
    >
      {children}
    </div>
  );
}

/* ─── Input / Textarea ───────────────────────────────────────────────────── */

const INPUT_CLASSES =
  'w-full bg-[#111113] border border-white/10 rounded-lg px-3 py-2 text-xs font-sans text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#7C7CF4]/60 focus:ring-1 focus:ring-[#7C7CF4]/25 transition-all disabled:opacity-50';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(INPUT_CLASSES, className)} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(INPUT_CLASSES, 'resize-y min-h-[72px]', className)} {...props} />;
  },
);

/* ─── Segmented Control ──────────────────────────────────────────────────── */

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'flex items-center gap-0.5 p-1 rounded-lg bg-[#111113] border border-white/[0.08]',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-sans font-medium transition-colors duration-150',
              active
                ? 'bg-[#7C7CF4]/[0.14] text-white'
                : 'text-zinc-500 hover:text-white hover:bg-white/[0.04]',
            )}
          >
            {opt.icon && <span className={cn('shrink-0 [&>svg]:block', active ? 'text-[#8F8FF7]' : 'text-zinc-600')}>{opt.icon}</span>}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Section Header / Eyebrow ───────────────────────────────────────────── */

export function SectionHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'text-[10px] font-sans font-semibold uppercase tracking-widest text-zinc-500 select-none',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* ─── Badge ──────────────────────────────────────────────────────────────── */

export type BadgeTone = 'accent' | 'success' | 'danger' | 'warning' | 'neutral';

const BADGE_TONES: Record<BadgeTone, string> = {
  accent: 'bg-[#7C7CF4]/10 text-[#8F8FF7] border-[#7C7CF4]/25',
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  danger: 'bg-red-500/10 text-red-400 border-red-500/25',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  neutral: 'bg-white/[0.04] text-zinc-400 border-white/[0.08]',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-sans font-medium leading-4',
        BADGE_TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/* ─── Kbd (keyboard hint — one of the sanctioned mono usages) ────────────── */

export function Kbd({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-white/10 bg-white/[0.04] text-[10px] font-mono text-zinc-500',
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}
