import { useEffect, useRef } from 'react';

interface LightRaysProps {
  color?: string;
  rayCount?: number;
  speed?: number;
  intensity?: number;
}

/**
 * React Bits–style volumetric light rays (canvas, no WebGL).
 */
export function LightRays({
  color = '16, 185, 129',
  rayCount = 14,
  speed = 0.0004,
  intensity = 0.25,
}: LightRaysProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.3 });
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight };
    };
    window.addEventListener('mousemove', onMove, { passive: true });

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
      phaseRef.current += speed;
      const phase = phaseRef.current;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      ctx.clearRect(0, 0, w, h);

      const originX = w * (0.5 + (mx - 0.5) * 0.12);
      const originY = h * (-0.05 + my * 0.08);

      for (let i = 0; i < rayCount; i++) {
        const spread = (i / rayCount) * Math.PI * 0.85 + Math.PI * 0.075;
        const wobble = Math.sin(phase * 2 + i * 0.7) * 0.08;
        const angle = spread + wobble - Math.PI / 2;
        const len = h * 1.4;
        const endX = originX + Math.cos(angle) * len;
        const endY = originY + Math.sin(angle) * len;

        const grad = ctx.createLinearGradient(originX, originY, endX, endY);
        const alpha = intensity * (0.45 + 0.55 * Math.sin(phase + i));
        grad.addColorStop(0, `rgba(${color}, ${alpha * 0.9})`);
        grad.addColorStop(0.35, `rgba(${color}, ${alpha * 0.25})`);
        grad.addColorStop(1, `rgba(${color}, 0)`);

        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5 + (i % 3) * 0.5;
        ctx.globalCompositeOperation = 'screen';
        ctx.stroke();
      }

      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
    };
  }, [color, rayCount, speed, intensity]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none light-rays-canvas"
      aria-hidden
    />
  );
}
