/** A connected BX monogram: a rounded shoulder, structural diagonal, and cut terminal. */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`buildx-symbol ${className}`}
      viewBox="0 0 74 50"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6 5H23C31 5 37 9 37 16C37 20 34.5 23 31 24.5C35.5 26 38 29.5 38 34C38 41 32 45 23 45H6V5ZM13 12V21H22C26.5 21 29 19.5 29 16.5C29 13.5 26.5 12 22 12H13ZM13 28V38H23C27.5 38 30 36.5 30 33C30 30 27.5 28 23 28H13Z"
        fill="currentColor"
      />
      <path
        d="M32 5H40L50 19.3L54.4 13H62.4L54 25L68 45H60L50 30.7L40 45H32L46 25Z"
        fill="currentColor"
      />
      <path
        className="buildx-symbol-terminal"
        d="M60 5H68L63.8 11H55.8Z"
        fill="currentColor"
      />
      <path
        className="buildx-symbol-trace"
        d="M9.5 8.5H23C29 8.5 33 10.5 36 16L64 41.5"
        pathLength="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <span className={`brand-lockup brand-lockup--${size}`}>
      <BrandMark />
      <strong>BuildX</strong>
    </span>
  );
}
