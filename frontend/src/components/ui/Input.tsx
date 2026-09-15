import React, { forwardRef } from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      className,
      id,
      "aria-invalid": ariaInvalid,
      "aria-describedby": describedBy,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText && !error ? `${inputId}-helper` : undefined;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="label">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : ariaInvalid}
          aria-describedby={
            [describedBy, errorId, helperId].filter(Boolean).join(" ") ||
            undefined
          }
          className={cn(
            "w-full bg-surface-1 border border-default rounded-lg px-3 py-2 text-sm font-sans text-white placeholder:text-zinc-400",
            "focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/25",
            "transition-all disabled:opacity-50",
            error && "border-danger focus:border-danger focus:ring-red-500/25",
            className,
          )}
          {...props}
        />
        {error && (
          <p
            id={errorId}
            className="mt-1.5 text-xs text-danger font-sans"
            role="alert"
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="mt-1.5 text-xs text-zinc-400 font-sans">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
