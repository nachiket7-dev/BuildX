import { useRef } from "react";
export function PanelResizeHandle({
  label,
  value,
  min,
  max,
  onChange,
  reverse = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  reverse?: boolean;
}) {
  const drag = useRef<{ x: number; value: number } | null>(null);
  const update = (next: number) => onChange(Math.max(min, Math.min(max, next)));
  return (
    <div
      className="workspace-resizer"
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation="vertical"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, value };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (drag.current)
          update(
            drag.current.value +
              (e.clientX - drag.current.x) * (reverse ? -1 : 1),
          );
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          update(
            value + (e.key === "ArrowRight" ? 16 : -16) * (reverse ? -1 : 1),
          );
        } else if (e.key === "Home" || e.key === "End") {
          e.preventDefault();
          update(e.key === "Home" ? min : max);
        }
      }}
    />
  );
}
