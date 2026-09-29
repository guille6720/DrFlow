"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { RefepsClinicSettingsView } from "@/lib/actions/refeps";
import { updateRefepsClinicSettings } from "@/lib/actions/refeps";

type Props = {
  settings: RefepsClinicSettingsView;
};

export function RefepsSettingsPanel({ settings }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [autoSubmit, setAutoSubmit] = useState(settings.autoSubmit);
  const [establishmentCode, setEstablishmentCode] = useState(settings.establishmentCode ?? "");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setErr(null);

    const fd = new FormData();
    if (enabled) fd.set("refeps_enabled", "true");
    if (autoSubmit) fd.set("refeps_auto_submit", "true");
    fd.set("refeps_establishment_code", establishmentCode);

    const result = await updateRefepsClinicSettings(fd);
    setLoading(false);
    if (result.error) setErr(result.error);
    else {
      setMsg(result.message ?? "Configuración REFEPS guardada.");
      router.refresh();
    }
  }

  return (
    <Card title="Receta electrónica nacional (preparado para integración ReNaPDiS)">
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div>
          <p className="font-medium">Preparado para integración — sin homologación oficial</p>
          <p className="mt-1">
            REFEPS valida al profesional. El registro de la receta y el CUIR los otorga un repositorio
            ReNaPDiS homologado, no NexClinic. Hasta contar con credenciales oficiales, el envío nacional
            permanece bloqueado (o en modo de prueba en staging, sin validez para dispensa).
          </p>
          <p className="mt-2 text-xs text-amber-900">
            Validación REFEPS en el servidor:{" "}
            <strong>
              {settings.submissionMode === "sandbox"
                ? "Sandbox (prueba)"
                : settings.submissionMode === "api"
                  ? "Credenciales presentes (adaptador oficial pendiente)"
                  : "No configurada"}
            </strong>
            {!settings.apiConfigured ? ` — ${settings.configurationHint}` : null}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span>
            <span className="font-medium">Marcar recetas para envío nacional</span>
            <span className="mt-0.5 block text-slate-600">
              Solo tiene efecto si el Superadmin habilitó la receta electrónica nacional para la
              clínica y la integración está lista. La receta local sigue funcionando igual.
            </span>
          </span>
        </label>

        <div>
          <label htmlFor="refeps_establishment_code" className="mb-1 block text-sm font-medium">
            Código de establecimiento (asignado oficialmente)
          </label>
          <Input
            id="refeps_establishment_code"
            value={establishmentCode}
            onChange={(e) => setEstablishmentCode(e.target.value)}
            placeholder="Ej. EST-12345"
            disabled={!enabled}
          />
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={autoSubmit}
            onChange={(e) => setAutoSubmit(e.target.checked)}
            disabled={!enabled}
          />
          <span>
            <span className="font-medium">Enviar automáticamente al emitir receta</span>
            <span className="mt-0.5 block text-slate-600">
              Si está desactivado, podés enviar manualmente desde cada receta emitida.
            </span>
          </span>
        </label>

        {err ? <p className="text-sm text-red-700">{err}</p> : null}
        {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}

        <Button type="submit" loading={loading}>
          Guardar
        </Button>
      </form>
    </Card>
  );
}
