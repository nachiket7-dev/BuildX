import React, { useRef, useState, useCallback } from 'react';

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
  spotlightSize?: number;
  tiltMax?: number;
  /** When true, inner wrapper fills a fixed-height flex parent (e.g. sandbox console) */
  fillHeight?: boolean;
}

export const SpotlightCard = React.forwardRef<HTMLDivElement, SpotlightCardProps>(({
  children,
  className = '',
  spotlightColor = 'rgba(20, 184, 166, 0.15)',
  spotlightSize = 250,
  tiltMax = 8,
  fillHeight = false,
  style = {},
  ...props
}, ref) => {
  const localRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });

  const setRefs = useCallback((node: HTMLDivElement | null) => {
    (localRef as any).current = node;
    if (ref) {
      if (typeof ref === 'function') {
        ref(node);
      } else {
        (ref as any).current = node;
      }
    }
  }, [ref]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!localRef.current) return;
    const rect = localRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPosition({ x, y });

    // Compute 3D tilt based on cursor offset from center
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateY = ((x - centerX) / centerX) * tiltMax;
    const rotateX = -((y - centerY) / centerY) * tiltMax;
    setTilt({ rotateX, rotateY });
  };

  const handleMouseEnter = () => setIsFocused(true);
  const handleMouseLeave = () => {
    setIsFocused(false);
    setTilt({ rotateX: 0, rotateY: 0 });
  };

  return (
    <div
      ref={setRefs}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`glass-card relative overflow-hidden border border-white/5 hover:border-white/10 ${className}`}
      style={{
        ...style,
        transform: isFocused
          ? `perspective(800px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) translateY(-2px)`
          : 'perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0px)',
        transition: isFocused
          ? 'transform 0.1s ease-out, border-color 0.3s, box-shadow 0.3s'
          : 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1), border-color 0.3s, box-shadow 0.3s',
        willChange: 'transform',
      }}
      {...props}
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
        style={{
          opacity: isFocused ? 1 : 0,
          background: `radial-gradient(${spotlightSize}px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 80%)`,
        }}
      />
      <div
        className={
          fillHeight
            ? 'relative z-10 flex h-full min-h-0 w-full flex-1 flex-col'
            : 'relative z-10 w-full'
        }
      >
        {children}
      </div>
    </div>
  );
});

SpotlightCard.displayName = 'SpotlightCard';
