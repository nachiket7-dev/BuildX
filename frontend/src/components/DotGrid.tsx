import { useEffect, useRef } from 'react';

interface DotGridProps {
  dotSize?: number;
  gap?: number;
  baseOpacity?: number;
  glowRadius?: number;
}

/**
 * React Bits–style dot grid with cursor spotlight (canvas).
 */
export function DotGrid({
  dotSize = 1.2,
  gap = 28,
  baseOpacity = 0.22,
  glowRadius = 140,
}: DotGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const smoothRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const onLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseleave', onLeave);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      smoothRef.current.x += (mouseRef.current.x - smoothRef.current.x) * 0.08;
      smoothRef.current.y += (mouseRef.current.y - smoothRef.current.y) * 0.08;

      ctx.clearRect(0, 0, w, h);

      const cols = Math.ceil(w / gap) + 1;
      const rows = Math.ceil(h / gap) + 1;
      const offsetX = (w % gap) / 2;
      const offsetY = (h % gap) / 2;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * gap + offsetX;
          const y = row * gap + offsetY;
          const dx = x - smoothRef.current.x;
          const dy = y - smoothRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const glow = Math.max(0, 1 - dist / glowRadius);
          const opacity = baseOpacity + glow * 0.55;
          const scale = 1 + glow * 1.2;

          ctx.beginPath();
          ctx.arc(x, y, dotSize * scale, 0, Math.PI * 2);
          if (glow > 0.15) {
            ctx.fillStyle = `rgba(167, 139, 250, ${opacity})`;
          } else {
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.35})`;
          }
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, [dotSize, gap, baseOpacity, glowRadius]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none dot-grid-canvas"
      aria-hidden
    />
  );
}
