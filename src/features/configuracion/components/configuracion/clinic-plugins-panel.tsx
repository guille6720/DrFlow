"use client";

import { Puzzle } from "lucide-react";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { updateClinicPlugin } from "@/lib/actions/clinic-plugins";
import type { PluginId } from "@/plugins/registry";

type PluginRow = {
  id: PluginId;
  label: string;
  description: string;
  tier: string;
  enabled: boolean;
};

type Props = {
  plugins: PluginRow[];
};

export function ClinicPluginsPanel({ plugins: initial }: Props) {
  const [plugins, setPlugins] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(id: PluginId, enabled: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await updateClinicPlugin(id, enabled);
      if (result.error) {
        setError(result.error);
        return;
      }
      setPlugins((prev) => prev.map((p) => (p.id === id ? { ...p, enabled } : p)));
    });
  }

  return (
    <Card title="Plugins del consultorio">
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-indigo-100 bg-indigo-50/80 px-3 py-2 text-sm text-indigo-900">
        <Puzzle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Activá o desactivá módulos sin recompilar. El núcleo clínico (agenda, pacientes, HC,
          recetas, caja) siempre permanece disponible.
        </p>
      </div>

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      <ul className="divide-y divide-slate-100">
        {plugins.map((plugin) => (
          <li key={plugin.id} className="flex items-start justify-between gap-4 py-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-slate-900">{plugin.label}</p>
                {plugin.tier === "lab" ? (
                  <Badge variant="warning">Lab</Badge>
                ) : (
                  <Badge variant="info">Plugin</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-600">{plugin.description}</p>
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={plugin.enabled}
                disabled={pending}
                onChange={(e) => toggle(plugin.id, e.target.checked)}
              />
              {plugin.enabled ? "Activo" : "Off"}
            </label>
          </li>
        ))}
      </ul>
    </Card>
  );
}
