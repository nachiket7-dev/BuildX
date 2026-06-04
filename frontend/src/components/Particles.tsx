import { useEffect, useRef } from 'react';

interface ParticlesProps {
  count?: number;
  color?: string;
  maxDistance?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
}

export function Particles({
  count = 55,
  color = 'rgba(167, 139, 250, 0.5)',
  maxDistance = 120,
}: ParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const particles: Particle[] = [];

    let w = window.innerWidth;
    let h = window.innerHeight;

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    // Track mouse coordinates
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };

    const handleMouseLeave = () => {
      mouseRef.current.x = -1000;
      mouseRef.current.y = -1000;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    // Initialize particles
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 1.8 + 0.8,
        opacity: Math.random() * 0.5 + 0.3,
      });
    }

    const drawParticles = () => {
      ctx.clearRect(0, 0, w, h);

      const mouse = mouseRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];

        // Move particle
        p1.x += p1.vx;
        p1.y += p1.vy;

        // Bounce off bounds
        if (p1.x < 0 || p1.x > w) p1.vx *= -1;
        if (p1.y < 0 || p1.y > h) p1.vy *= -1;

        // Keep inside bounds
        p1.x = Math.max(0, Math.min(w, p1.x));
        p1.y = Math.max(0, Math.min(h, p1.y));

        // Subtle cursor attraction force
        if (mouse.x !== -1000) {
          const dx = mouse.x - p1.x;
          const dy = mouse.y - p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200) {
            p1.x += dx * 0.002;
            p1.y += dy * 0.002;
          }
        }

        // Draw particle with glow near cursor
        let particleRadius = p1.radius;
        let particleOpacity = p1.opacity;

        if (mouse.x !== -1000) {
          const dx = p1.x - mouse.x;
          const dy = p1.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 160) {
            const boost = 1 - dist / 160;
            particleRadius += boost * 2;
            particleOpacity = Math.min(1, particleOpacity + boost * 0.4);
          }
        }

        // Draw glow halo
        const glow = ctx.createRadialGradient(p1.x, p1.y, 0, p1.x, p1.y, particleRadius * 4);
        glow.addColorStop(0, `rgba(167, 139, 250, ${particleOpacity * 0.15})`);
        glow.addColorStop(1, 'rgba(167, 139, 250, 0)');
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, particleRadius * 4, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Draw particle core
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, particleRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(167, 139, 250, ${particleOpacity})`;
        ctx.fill();

        // Connect particles that are close
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDistance) {
            const alpha = (1 - dist / maxDistance) * 0.12;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(139, 92, 246, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }

        // Connect to cursor with teal lines
        if (mouse.x !== -1000) {
          const dx = p1.x - mouse.x;
          const dy = p1.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 160) {
            const alpha = (1 - dist / 160) * 0.22;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(34, 211, 165, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(drawParticles);
    };

    drawParticles();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, [count, color, maxDistance]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}
