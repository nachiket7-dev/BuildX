import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'hover' | 'panel';
}



export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', className, children, ...props }, ref) => {

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl bg-surface-1 border border-default shadow-md transition-default',
          variant === 'hover' && 'hover:border-strong hover:shadow-lg',
          variant === 'panel' && 'bg-surface-2 rounded-lg',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const Panel = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {

    return (
      <div
        ref={ref}
        className={cn('rounded-lg bg-surface-2 border border-default shadow-md', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Panel.displayName = 'Panel';
