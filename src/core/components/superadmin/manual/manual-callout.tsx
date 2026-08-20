import type { ReactNode } from "react";

type ManualCalloutVariant = "info" | "warning" | "danger" | "success";

const STYLES: Record<ManualCalloutVariant, string> = {
  info: "border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100",
  warning:
    "border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-100",
  danger:
    "border-red-400 bg-red-50 text-red-950 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100",
  success:
    "border-teal-300 bg-teal-50 text-teal-950 dark:border-teal-700 dark:bg-teal-950/40 dark:text-teal-100",
};

export function ManualCallout({
  title,
  children,
  variant = "info",
}: {
  title?: string;
  children: ReactNode;
  variant?: ManualCalloutVariant;
}) {
  return (
    <aside
      className={`rounded-lg border px-4 py-3 text-sm ${STYLES[variant]}`}
      data-manual-callout={variant}
    >
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      <div className="space-y-1 leading-relaxed">{children}</div>
    </aside>
  );
}
