"use client";

import { Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { PatientDeactivationEvaluation } from "@/core/compliance/data-retention-policy";

import { Button } from "@/components/ui/button";
import { loadPatientDeactivationPolicy } from "@/lib/actions/data-retention";
import { deactivatePatient } from "@/lib/actions/settings";

interface DeletePatientButtonProps {
  patientId: string;
  patientName: string;
}

export function DeletePatientButton({ patientId, patientName }: DeletePatientButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingPolicy, setLoadingPolicy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [policy, setPolicy] = useState<PatientDeactivationEvaluation | null>(null);
  const [retentionAcknowledged, setRetentionAcknowledged] = useState(false);

  async function handleOpen() {
    setError(null);
    setOpen(true);
    setLoadingPolicy(true);
    setPolicy(null);
    setRetentionAcknowledged(false);
    const result = await loadPatientDeactivationPolicy(patientId);
    if (result.error) setError(result.error);
    else setPolicy(result.data ?? null);
    setLoadingPolicy(false);
  }

  async function handleDelete() {
    setLoading(true);
    setError(null);
    const formData = new FormData();
    if (retentionAcknowledged) formData.set("retention_acknowledged", "true");
    const result = await deactivatePatient(patientId, formData);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.push("/pacientes");
  }

  const requiresAck = policy?.requiresRetentionAcknowledgment ?? false;
  const canConfirm = !requiresAck || retentionAcknowledged;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-red-200 text-red-700 hover:bg-red-50"
        onClick={() => void handleOpen()}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Dar de baja paciente
      </Button>

      {open && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50"
            aria-label="Cerrar"
            onClick={() => !loading && setOpen(false)}
          />
          <div className="drflow-card-light relative z-10 w-full max-w-md rounded-2xl bg-white p-5 text-slate-900 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Baja lógica del paciente</h2>
                <p className="mt-1 text-sm text-slate-600">{patientName}</p>
              </div>
              <button
                type="button"
                onClick={() => !loading && setOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingPolicy ? (
              <p className="text-sm text-slate-500">Cargando política de retención…</p>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-slate-600">
                  El paciente dejará de aparecer en el listado activo.{" "}
                  <strong className="text-slate-900">
                    No se eliminan historias clínicas, recetas, consentimientos ni auditoría.
                  </strong>
                </p>
                {policy?.warningMessage ? (
                  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {policy.warningMessage}
                  </p>
                ) : null}
                {requiresAck ? (
                  <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-slate-700">
                    <input
                      type="checkbox"
                      checked={retentionAcknowledged}
                      onChange={(e) => setRetentionAcknowledged(e.target.checked)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span>
                      Confirmo que la baja es lógica y que los datos clínicos se conservarán al
                      menos {policy?.retentionYears} años desde la última consulta, según la
                      política del consultorio (Ley 26.529).
                    </span>
                  </label>
                ) : null}
              </>
            )}

            {error && (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="danger"
                loading={loading}
                pendingLabel="Dando de baja..."
                disabled={loadingPolicy || !canConfirm}
                onClick={handleDelete}
              >
                Confirmar baja
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
