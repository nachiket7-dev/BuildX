import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export const SectionHeader = forwardRef<HTMLDivElement, SectionHeaderProps>(
  ({ className, children, ...props }, ref) => {
    const restProps = { ...props };
    delete (restProps as Record<string, unknown>).className;

    return (
      <div
        ref={ref}
        className={cn(
          'text-[10px] font-sans font-semibold uppercase tracking-widest text-zinc-500 select-none',
          className
        )}
        {...restProps}
      >
        {children}
      </div>
    );
  }
);

SectionHeader.displayName = 'SectionHeader';
