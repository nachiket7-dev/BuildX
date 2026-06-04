import React from 'react';

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  colors?: string[];
  animationSpeed?: number; // duration in seconds
  showBorder?: boolean;
}

export function GradientText({
  children,
  className = '',
  colors = ['#9d7aff', '#7cff67', '#5227FF', '#7cff67', '#5227FF'],
  animationSpeed = 8,
  showBorder = false,
}: GradientTextProps) {
  const gradientString = colors.join(', ');

  return (
    <span
      className={`relative inline ${className}`}
    >
      {showBorder && (
        <span
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            padding: '1px',
            background: `linear-gradient(90deg, ${gradientString})`,
            backgroundSize: '300% 100%',
            animation: `gradient-text-shimmer ${animationSpeed}s linear infinite`,
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
        />
      )}
      <span
        style={{
          background: `linear-gradient(90deg, ${gradientString})`,
          backgroundSize: '300% 100%',
          animation: `gradient-text-shimmer ${animationSpeed}s linear infinite`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {children}
      </span>
      
      {/* Dynamic shimmer keyframe inject if not already done */}
      <style>{`
        @keyframes gradient-text-shimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </span>
  );
}
