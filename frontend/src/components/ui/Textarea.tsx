import React, { forwardRef } from "react";
import { cn } from "../../lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
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
    const textareaId = id ?? generatedId;
    const errorId = error ? `${textareaId}-error` : undefined;
    const helperId = helperText && !error ? `${textareaId}-helper` : undefined;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="label">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={error ? true : ariaInvalid}
          aria-describedby={
            [describedBy, errorId, helperId].filter(Boolean).join(" ") ||
            undefined
          }
          className={cn(
            "w-full bg-surface-1 border border-default rounded-lg px-3 py-2 text-sm font-sans text-white placeholder:text-zinc-400",
            "focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/25",
            "transition-all disabled:opacity-50 resize-y min-h-20",
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

Textarea.displayName = "Textarea";
