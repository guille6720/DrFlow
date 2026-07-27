"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  clearClinicClinicalHistory,
  CLEAR_CLINICAL_HISTORY_CONFIRM_PHRASE,
} from "@/lib/actions/clinical-reset";

interface Props {
  clinicName: string;
}

export function ClearClinicalHistoryPanel({ clinicName }: Props) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function handleClear() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await clearClinicClinicalHistory(confirmation);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setResult(
        `Listo: ${res.clinicalRecordsDeleted} consulta(s), ${res.attachmentsDeleted} adjunto(s) y ${res.prescriptionDraftsDeleted} borrador(es) de receta eliminados. Los pacientes no se tocaron.`
      );
      setConfirmation("");
      router.refresh();
    } catch {
      setError("Error de conexión al vaciar historias.");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = confirmation.trim() === CLEAR_CLINICAL_HISTORY_CONFIRM_PHRASE;

  return (
    <section className="mt-8 rounded-xl border border-red-200 bg-red-50/40 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-red-950">Vaciar historias clínicas</h2>
          <p className="mt-1 text-sm text-red-900/90">
            Borra todas las consultas, adjuntos (PDF, CSV HCE) y borradores de recetas de la
            clínica <strong>{clinicName}</strong>. <strong>No elimina pacientes.</strong> Usalo
            antes de reimportar consumers → HCE → PDF desde cero.
          </p>

          <div className="mt-4 max-w-md space-y-3">
            <Input
              label={`Escribí ${CLEAR_CLINICAL_HISTORY_CONFIRM_PHRASE} para confirmar`}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
              disabled={loading}
            />
            <Button
              type="button"
              variant="danger"
              loading={loading}
              disabled={!canSubmit || loading}
              onClick={() => void handleClear()}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Borrando…
                </>
              ) : (
                "Vaciar historias de esta clínica"
              )}
            </Button>
          </div>

          {error && <p className="mt-3 text-sm text-red-800">{error}</p>}
          {result && <p className="mt-3 text-sm font-medium text-emerald-800">{result}</p>}
        </div>
      </div>
    </section>
  );
}
