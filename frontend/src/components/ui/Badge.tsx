import React from 'react';
import { cn } from '../../lib/utils';

export type BadgeTone = 'accent' | 'success' | 'danger' | 'warning' | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ tone = 'neutral', className, children, ...props }, ref) => {
    const TONES = {
      accent: 'bg-accent-muted text-[#8F8FF7] border-accent/25',
      success: 'bg-success-dim text-emerald-400 border-emerald-500/25',
      danger: 'bg-danger-dim text-red-400 border-red-500/25',
      warning: 'bg-warning-dim text-amber-400 border-amber-500/25',
      neutral: 'bg-white/[0.04] text-zinc-400 border-white/[0.08]',
    };

    const restProps = { ...props };
    delete (restProps as Record<string, unknown>).className;

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-sans font-medium leading-4',
          TONES[tone],
          className
        )}
        {...restProps}
      >
        {children}
      </span>
    );
  }
);

export const BadgeAccent = ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <Badge tone="accent" {...props}>{children}</Badge>;
export const BadgeSuccess = ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <Badge tone="success" {...props}>{children}</Badge>;
export const BadgeDanger = ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <Badge tone="danger" {...props}>{children}</Badge>;
export const BadgeWarning = ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <Badge tone="warning" {...props}>{children}</Badge>;
export const BadgeNeutral = ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <Badge tone="neutral" {...props}>{children}</Badge>;
