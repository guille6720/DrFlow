import { forwardRef, type SelectHTMLAttributes } from "react";

import { cn } from "@/shared/utils/cn";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, id, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s/g, "-");
    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={selectId} className="drflow-ui-label block text-sm font-medium">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "drflow-ui-input drflow-ui-select w-full rounded-[10px] border border-[var(--border-strong,var(--border,#cbd5e1))] bg-[var(--input,var(--card,#fff))] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-[3px] focus:ring-[var(--ring)]/15",
            error && "border-[var(--destructive)]",
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
        {error && <p className="drflow-ui-error text-xs">{error}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";
