import { useId, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("ui-segmented", className)}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          tabIndex={value === opt.value ? 0 : -1}
          className="ui-segment"
          onClick={() => onChange(opt.value)}
          onKeyDown={(event) => {
            if (
              ![
                "ArrowLeft",
                "ArrowRight",
                "ArrowUp",
                "ArrowDown",
                "Home",
                "End",
              ].includes(event.key)
            )
              return;
            event.preventDefault();
            const index = options.findIndex((option) => option.value === value);
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? options.length - 1
                  : (index +
                      (["ArrowRight", "ArrowDown"].includes(event.key)
                        ? 1
                        : -1) +
                      options.length) %
                    options.length;
            onChange(options[next].value);
            (
              event.currentTarget.parentElement?.children[
                next
              ] as HTMLButtonElement
            )?.focus();
          }}
        >
          {value === opt.value && (
            <motion.span
              className="ui-segment-pill"
              layoutId={`segment-${id}`}
              transition={{ type: "spring", stiffness: 420, damping: 36 }}
            />
          )}
          <span className="ui-segment-label">
            {opt.icon}
            {opt.label}
          </span>
        </button>
      ))}
    </div>
  );
}
