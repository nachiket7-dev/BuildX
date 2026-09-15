import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';



export interface KbdProps extends React.HTMLAttributes<HTMLElement> {}

export const Kbd = forwardRef<HTMLElement, KbdProps>(
  ({ className, children, ...props }, ref) => {
    const restProps = { ...props };
    delete (restProps as Record<string, unknown>).className;

    return (
      <kbd
        ref={ref}
        className={cn(
          'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-default bg-white/[0.04] text-[10px] font-mono text-zinc-500',
          className
        )}
        {...restProps}
      >
        {children}
      </kbd>
    );
  }
);

Kbd.displayName = 'Kbd';
