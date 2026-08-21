import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/shared/utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, required, disabled, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s/g, "-");
    const helperId = helperText && inputId ? `${inputId}-helper` : undefined;
    const errorId = error && inputId ? `${inputId}-error` : undefined;
    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              "drflow-ui-label block text-sm font-medium",
              error && "drflow-ui-label-error"
            )}
            data-invalid={error ? "true" : undefined}
          >
            {label}
            {required ? (
              <span className="drflow-ui-required" aria-hidden="true">
                *
              </span>
            ) : null}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          aria-describedby={[helperId, errorId].filter(Boolean).join(" ") || undefined}
          className={cn(
            "drflow-ui-input w-full rounded-[10px] border border-[var(--border-strong,var(--border,#cbd5e1))] bg-[var(--surface-input,var(--input,var(--card,#fff)))] px-3 py-2 text-sm text-[var(--text-primary,var(--foreground))] placeholder:text-[var(--placeholder,var(--text-muted,#64748b))] focus:border-[var(--ring)] focus:outline-none focus:ring-[3px] focus:ring-[var(--ring)]/15 disabled:cursor-not-allowed",
            error && "drflow-ui-input-error border-[var(--destructive)] focus:border-[var(--destructive)] focus:ring-[var(--destructive)]/20",
            className
          )}
          {...props}
        />
        {helperText && !error ? (
          <p id={helperId} className="drflow-ui-helper">
            {helperText}
          </p>
        ) : null}
        {error && (
          <p id={errorId} className="drflow-ui-error text-xs font-medium" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
