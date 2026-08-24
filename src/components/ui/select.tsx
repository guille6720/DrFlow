import { forwardRef, type ReactNode, type SelectHTMLAttributes } from "react";

import { cn } from "@/shared/utils/cn";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: ReactNode;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    { className, label, error, helperText, options, placeholder, id, required, disabled, ...props },
    ref
  ) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s/g, "-");
    const helperId = helperText && selectId ? `${selectId}-helper` : undefined;
    const errorId = error && selectId ? `${selectId}-error` : undefined;
    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={selectId}
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
        <select
          ref={ref}
          id={selectId}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          aria-describedby={[helperId, errorId].filter(Boolean).join(" ") || undefined}
          className={cn(
            "drflow-ui-input drflow-ui-select w-full rounded-[10px] border border-[var(--border-strong,var(--border,#cbd5e1))] bg-[var(--surface-input,var(--input,var(--card,#fff)))] px-3 py-2 text-sm text-[var(--text-primary,var(--foreground))] focus:border-[var(--ring)] focus:outline-none focus:ring-[3px] focus:ring-[var(--ring)]/15 disabled:cursor-not-allowed",
            error && "drflow-ui-input-error border-[var(--destructive)]",
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="">{placeholder}</option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {helperText && !error ? (
          <p id={helperId} className="drflow-ui-helper">
            {helperText}
          </p>
        ) : null}
        {error && (
          <p id={errorId} className="drflow-ui-error text-xs" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";
