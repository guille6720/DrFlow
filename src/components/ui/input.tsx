import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/shared/utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s/g, "-");
    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              "drflow-ui-label block text-sm font-medium",
              error && "text-red-700"
            )}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "drflow-ui-input w-full rounded-[10px] border border-[var(--border-strong,var(--input,#cbd5e1))] bg-[var(--input,var(--card,#fff))] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--placeholder,#64748b)] focus:border-[var(--ring)] focus:outline-none focus:ring-[3px] focus:ring-[var(--ring)]/15",
            error && "border-[var(--destructive)] focus:border-[var(--destructive)] focus:ring-[var(--destructive)]/20",
            className
          )}
          {...props}
        />
        {error && (
          <p className="drflow-ui-error text-xs font-medium" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
