import mark from "../brand/mark.json";

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`buildx-symbol ${className}`}
      viewBox={mark.viewBox}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {mark.parts.map((part) => (
        <path
          key={part.id}
          className={`brand-piece brand-${part.id}`}
          d={part.d}
          fill="currentColor"
          fillRule="evenodd"
        />
      ))}
    </svg>
  );
}

export function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <strong className={`brand-wordmark ${className}`}>
      Build
      <svg className="brand-name-x" viewBox={mark.wordmark.viewBox} aria-hidden="true" focusable="false">
        <path d={mark.wordmark.cross} fill="currentColor" />
      </svg>
      <span className="brand-a11y-x">X</span>
    </strong>
  );
}

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <span className={`brand-lockup brand-lockup--${size}`}>
      <BrandMark />
      <BrandWordmark />
    </span>
  );
}
