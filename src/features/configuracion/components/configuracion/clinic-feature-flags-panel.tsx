"use client";

import { ToggleLeft } from "lucide-react";
import { useState, useTransition } from "react";

import type { FeatureFlagId } from "@/features/flags/lib/registry";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { updateClinicFeatureFlag } from "@/lib/actions/clinic-feature-flags";

type FlagRow = {
  id: FeatureFlagId;
  label: string;
  description: string;
  category: string;
  enabled: boolean;
  requiresPlugin?: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  ux: "Experiencia",
  clinical: "Clínico",
  agenda: "Agenda",
  compliance: "Cumplimiento",
};

type Props = {
  flags: FlagRow[];
};

export function ClinicFeatureFlagsPanel({ flags: initial }: Props) {
  const [flags, setFlags] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(id: FeatureFlagId, enabled: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await updateClinicFeatureFlag(id, enabled);
      if (result.error) {
        setError(result.error);
        return;
      }
      setFlags((prev) => prev.map((f) => (f.id === id ? { ...f, enabled } : f)));
    });
  }

  return (
    <Card title="Feature flags">
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-teal-100 bg-teal-50/80 px-3 py-2 text-sm text-teal-900">
        <ToggleLeft className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Funciones granulares dentro de los módulos. Los cambios aplican al instante, sin
          redeploy. Si un plugin está desactivado, sus flags dependientes quedan off.
        </p>
      </div>

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      <ul className="divide-y divide-slate-100">
        {flags.map((flag) => (
          <li key={flag.id} className="flex items-start justify-between gap-4 py-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-slate-900">{flag.label}</p>
                <Badge variant="info">{CATEGORY_LABELS[flag.category] ?? flag.category}</Badge>
                {flag.requiresPlugin ? (
                  <Badge variant="warning">Requiere {flag.requiresPlugin}</Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-slate-600">{flag.description}</p>
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={flag.enabled}
                disabled={pending}
                onChange={(e) => toggle(flag.id, e.target.checked)}
              />
              {flag.enabled ? "Activo" : "Off"}
            </label>
          </li>
        ))}
      </ul>
    </Card>
  );
}
