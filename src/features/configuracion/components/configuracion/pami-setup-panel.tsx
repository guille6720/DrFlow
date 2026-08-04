"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { configurePamiCabecera } from "@/lib/actions/pami-setup";
import { HeartPulse, Loader2 } from "lucide-react";

interface PamiSetupPanelProps {
  practiceProfile: string | null;
  defaultInsurance: string | null;
}

export function PamiSetupPanel({ practiceProfile, defaultInsurance }: PamiSetupPanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const isConfigured = practiceProfile === "cabecera_pami";

  async function handleSetup() {
    setLoading(true);
    setMsg(null);
    setErr(null);
    const result = await configurePamiCabecera();
    if (result.error) setErr(result.error);
    else {
      setMsg(result.message ?? "Perfil PAMI activado.");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <Card title="Consultorio PAMI — médico de cabecera">
      <p className="mb-3 text-sm text-slate-600">
        Activa plantillas clínicas para HTA, DM2, EPOC, renovación de medicación, motivos de
        consulta frecuentes y turnos de 20 minutos. Pacientes nuevos se cargan con cobertura PAMI.
      </p>

      {isConfigured ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Perfil activo · Cobertura por defecto: <strong>{defaultInsurance ?? "PAMI"}</strong>
          <span className="mt-1 block text-xs text-emerald-700">
            Plantillas en Nueva consulta · Estudios y derivaciones en Historia clínica
          </span>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Todavía no configuraste el perfil PAMI cabecera para esta clínica.
        </div>
      )}

      {msg && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {msg}
        </div>
      )}
      {err && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {err}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={handleSetup} loading={loading} variant="secondary">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <HeartPulse className="h-4 w-4" />
          )}
          {isConfigured ? "Actualizar perfil PAMI" : "Activar consultorio PAMI cabecera"}
        </Button>
      </div>
    </Card>
  );
}
