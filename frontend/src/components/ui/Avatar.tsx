import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZE_CLASSES = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-[11px]',
  lg: 'w-10 h-10 text-[12px]',
  xl: 'w-12 h-12 text-[14px]',
};

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ src, alt, fallback, size = 'md', className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'relative inline-flex items-center justify-center rounded-full bg-surface-2 border border-default overflow-hidden shrink-0',
          SIZE_CLASSES[size],
          className
        )}
        {...props}
      >
        {src ? (
          <img
            src={src}
            alt={alt || ''}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="font-medium font-sans text-zinc-400 select-none">
            {fallback || '?'}
          </span>
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

// Avatar Group for stacked avatars
export const AvatarGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { max?: number }>(
  ({ max = 5, className, children, ...props }, ref) => {
    const kids = React.Children.toArray(children).slice(0, max);
    return (
      <div ref={ref} className={cn('flex -space-x-2', className)} {...props}>
        {React.Children.map(kids, (child, index) => (
          <div key={index} className="relative z-[{index}]" style={{ zIndex: max - index }}>
            {child}
          </div>
        ))}
        {React.Children.count(children) > max && (
          <div className={cn('bg-surface-2 border border-default', SIZE_CLASSES.md)}>
            +{React.Children.count(children) - max}
          </div>
        )}
      </div>
    );
  }
);

AvatarGroup.displayName = 'AvatarGroup';
