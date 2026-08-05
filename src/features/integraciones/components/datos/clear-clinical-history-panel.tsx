"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  clearClinicClinicalHistory,
  clearClinicFullMigrationReset,
} from "@/lib/actions/clinical-reset";
import {
  CLEAR_CLINICAL_HISTORY_CONFIRM_PHRASE,
  CLEAR_FULL_MIGRATION_CONFIRM_PHRASE,
} from "@/lib/constants/migration-reset";

interface Props {
  clinicName: string;
}

export function ClearClinicalHistoryPanel({ clinicName }: Props) {
  const router = useRouter();
  const [historyConfirm, setHistoryConfirm] = useState("");
  const [fullConfirm, setFullConfirm] = useState("");
  const [loading, setLoading] = useState<"history" | "full" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function handleHistoryOnly() {
    setLoading("history");
    setError(null);
    setResult(null);
    try {
      const res = await clearClinicClinicalHistory(historyConfirm);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setResult(
        `Historias vaciadas: ${res.clinicalRecordsDeleted} consulta(s), ${res.attachmentsDeleted} adjunto(s), ${res.prescriptionDraftsDeleted} receta(s). Pacientes intactos.`
      );
      setHistoryConfirm("");
      router.refresh();
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(null);
    }
  }

  async function handleFullReset() {
    setLoading("full");
    setError(null);
    setResult(null);
    try {
      const res = await clearClinicFullMigrationReset(fullConfirm);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setResult(
        `Reinicio total: ${res.patientsDeleted} paciente(s), ${res.clinicalRecordsDeleted} consulta(s), ${res.attachmentsDeleted} adjunto(s), ${res.paymentsDeleted} pago(s) eliminados. Podés importar de nuevo desde el panel izquierdo.`
      );
      setFullConfirm("");
      router.refresh();
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-red-200 bg-red-50/40 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
        <div className="min-w-0 flex-1 space-y-8">
          <div>
            <h2 className="text-lg font-semibold text-red-950">Zona peligrosa — migración</h2>
            <p className="mt-1 text-sm text-red-900/90">
              Clínica: <strong>{clinicName}</strong>. Solo administradores. Turnos futuros ligados a
              pacientes también se eliminan en el reinicio total.
            </p>
          </div>

          <div className="space-y-3 border-t border-red-200/80 pt-4">
            <h3 className="text-sm font-semibold text-red-950">Solo historias clínicas</h3>
            <p className="text-sm text-red-900/80">
              Consultas, PDF/CSV HCE y borradores de recetas. <strong>Los pacientes quedan.</strong>
            </p>
            <div className="max-w-md space-y-3">
              <Input
                label={`Confirmación: ${CLEAR_CLINICAL_HISTORY_CONFIRM_PHRASE}`}
                value={historyConfirm}
                onChange={(e) => setHistoryConfirm(e.target.value)}
                autoComplete="off"
                disabled={loading !== null}
              />
              <Button
                type="button"
                variant="danger"
                loading={loading === "history"}
                disabled={
                  historyConfirm.trim() !== CLEAR_CLINICAL_HISTORY_CONFIRM_PHRASE ||
                  loading !== null
                }
                onClick={() => void handleHistoryOnly()}
              >
                Vaciar historias
              </Button>
            </div>
          </div>

          <div className="space-y-3 border-t border-red-200/80 pt-4">
            <h3 className="text-sm font-semibold text-red-950">Reinicio total (historias + pacientes)</h3>
            <p className="text-sm text-red-900/80">
              Todo lo anterior más <strong>todos los pacientes</strong> y pagos de la clínica. Para
              empezar migración desde cero.
            </p>
            <div className="max-w-md space-y-3">
              <Input
                label={`Confirmación: ${CLEAR_FULL_MIGRATION_CONFIRM_PHRASE}`}
                value={fullConfirm}
                onChange={(e) => setFullConfirm(e.target.value)}
                autoComplete="off"
                disabled={loading !== null}
              />
              <Button
                type="button"
                variant="danger"
                loading={loading === "full"}
                disabled={
                  fullConfirm.trim() !== CLEAR_FULL_MIGRATION_CONFIRM_PHRASE || loading !== null
                }
                onClick={() => void handleFullReset()}
              >
                Borrar historias y pacientes
              </Button>
            </div>
          </div>

          {error && <p className="text-sm text-red-800">{error}</p>}
          {result && <p className="text-sm font-medium text-emerald-800">{result}</p>}
        </div>
      </div>
    </section>
  );
}
