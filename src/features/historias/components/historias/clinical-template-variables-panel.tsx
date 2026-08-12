"use client";

import { Braces } from "lucide-react";

import { Input } from "@/components/ui/input";

type Props = {
  keys: string[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
};

export function ClinicalTemplateVariablesPanel({ keys, values, onChange }: Props) {
  if (keys.length === 0) return null;

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Braces className="h-4 w-4 shrink-0 text-teal-800" aria-hidden />
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-950">
          Variables de plantilla
        </p>
      </div>
      <p className="mb-3 text-xs text-teal-900/80">
        Completá los campos entre corchetes. Se actualizan en motivo, evolución, diagnóstico e
        indicaciones.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {keys.map((key) => (
          <Input
            key={key}
            label={`[${key}]`}
            value={values[key] ?? ""}
            placeholder={key}
            onChange={(e) => onChange(key, e.target.value)}
          />
        ))}
      </div>
    </div>
  );
}
