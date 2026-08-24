import type { ReactNode } from "react";

export function PatientEhrDemographicCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="drflow-ehr-demo-cell min-w-[7rem] flex-1 px-3 py-2">
      <p className="drflow-ehr-demo-label text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground,#475569)]">
        {label}
      </p>
      <p className="drflow-ehr-demo-value mt-0.5 truncate text-sm font-medium text-[var(--foreground,#0f172a)]">
        {value}
      </p>
    </div>
  );
}
