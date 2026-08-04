"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { seedDemoPatientsForActiveClinic } from "@/lib/actions/demo-data";
import { Database, Loader2 } from "lucide-react";

interface DemoDataPanelProps {
  patientCount: number;
}

export function DemoDataPanel({ patientCount }: DemoDataPanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleSeed() {
    setLoading(true);
    setMsg(null);
    setErr(null);

    const result = await seedDemoPatientsForActiveClinic();
    if (result.error) {
      setErr(result.error);
    } else {
      setMsg(result.message ?? "Datos demo cargados.");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div id="datos-demo">
      <Card title="Datos de prueba">
      <p className="mb-3 text-sm text-slate-600">
        Carga 12 pacientes ficticios, turnos de hoy y consultas demo para probar agenda,
        historias clínicas y recetas. Es idempotente: podés ejecutarlo más de una vez.
      </p>
      <p className="mb-4 text-xs text-slate-500">
        Pacientes actuales en tu clínica: <strong>{patientCount}</strong>
      </p>

      {msg && (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {msg}
        </div>
      )}
      {err && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {err}
        </div>
      )}

      <Button type="button" onClick={handleSeed} loading={loading} variant="secondary">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Database className="h-4 w-4" />
        )}
        Cargar pacientes demo
      </Button>
      </Card>
    </div>
  );
}
