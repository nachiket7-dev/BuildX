import { useEffect, useRef } from 'react';

interface BlobCursorProps {
  color?: string;
  size?: number;
  opacity?: number;
}

export function BlobCursor({
  color = 'rgba(20, 184, 166, 0.4)',
  size = 300,
  opacity = 0.3,
}: BlobCursorProps) {
  const blobRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: -500, y: -500 });
  const innerPos = useRef({ x: -500, y: -500 });
  const target = useRef({ x: -500, y: -500 });
  const raf = useRef<number>(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
    };

    const handleMouseLeave = () => {
      target.current.x = -500;
      target.current.y = -500;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    const animate = () => {
      // Outer blob — slow, dreamy follow
      pos.current.x += (target.current.x - pos.current.x) * 0.05;
      pos.current.y += (target.current.y - pos.current.y) * 0.05;

      // Inner highlight — snappier follow
      innerPos.current.x += (target.current.x - innerPos.current.x) * 0.12;
      innerPos.current.y += (target.current.y - innerPos.current.y) * 0.12;

      if (blobRef.current) {
        blobRef.current.style.transform = `translate(${pos.current.x - size / 2}px, ${pos.current.y - size / 2}px)`;
      }
      if (innerRef.current) {
        const innerSize = size * 0.35;
        innerRef.current.style.transform = `translate(${innerPos.current.x - innerSize / 2}px, ${innerPos.current.y - innerSize / 2}px)`;
      }

      raf.current = requestAnimationFrame(animate);
    };

    raf.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(raf.current);
    };
  }, [size]);

  const innerSize = size * 0.35;

  return (
    <>
      {/* Outer soft glow */}
      <div
        ref={blobRef}
        className="fixed top-0 left-0 pointer-events-none"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
          opacity,
          filter: 'blur(25px)',
          zIndex: 3,
          willChange: 'transform',
        }}
      />
      {/* Inner bright core */}
      <div
        ref={innerRef}
        className="fixed top-0 left-0 pointer-events-none"
        style={{
          width: innerSize,
          height: innerSize,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(167, 139, 250, 0.25) 0%, transparent 70%)',
          opacity: opacity * 1.2,
          filter: 'blur(15px)',
          zIndex: 3,
          willChange: 'transform',
        }}
      />
    </>
  );
}
