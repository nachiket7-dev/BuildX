
interface ShinyTextProps {
  text: string;
  className?: string;
  speed?: number; // duration in seconds
}

export function ShinyText({ text, className = '', speed = 6 }: ShinyTextProps) {
  return (
    <span
      className={`inline-block ${className}`}
      style={{
        backgroundImage: 'linear-gradient(120deg, rgba(255,255,255,0.15) 30%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.15) 70%)',
        backgroundSize: '200% auto',
        animation: `shine ${speed}s linear infinite`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}
    >
      {text}
    </span>
  );
}
