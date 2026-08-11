"use client";

import type { ReactNode } from "react";

type SectionProps = {
  title: string;
  children: ReactNode;
};

export function PrescriptionFormSection({ title, children }: SectionProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">{title}</h3>
      </div>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  );
}

type FieldProps = {
  label: string;
  value?: string | null;
};

export function PrescriptionReadonlyField({ label, value }: FieldProps) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-900">{value?.trim() || "—"}</p>
    </div>
  );
}
