"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cancelAppointmentRequest } from "@/features/agenda/utils/cancel-appointment-request";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

const CANCEL_REASON_OPTIONS = [
  { value: "patient", label: "Paciente" },
  { value: "professional", label: "Profesional" },
  { value: "clinic", label: "Clínica" },
  { value: "data_error", label: "Error de carga" },
  { value: "other", label: "Otro" },
] as const;

export type CancellationCategory = (typeof CANCEL_REASON_OPTIONS)[number]["value"];

interface CancelAppointmentDialogProps {
  open: boolean;
  appointmentId: string;
  onClose: () => void;
  /** Called after a successful cancel (e.g. close parent dialog). */
  onCancelled?: () => void;
  patientName?: string;
}

export function CancelAppointmentDialog({
  open,
  appointmentId,
  onClose,
  onCancelled,
  patientName,
}: CancelAppointmentDialogProps) {
  const router = useRouter();
  const [category, setCategory] = useState<CancellationCategory>("clinic");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleConfirm() {
    setError(null);
    setSubmitting(true);
    try {
      const data = await cancelAppointmentRequest(appointmentId, category);
      if ("error" in data) {
        setError(data.error);
        return;
      }

      setCategory("clinic");
      onClose();
      onCancelled?.();
      try {
        router.refresh();
      } catch {
        // Non-blocking
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar el turno");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting) return;
    setCategory("clinic");
    setError(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 pointer-events-auto"
        aria-label="Cerrar"
        onClick={handleClose}
      />
      <div
        className="drflow-card-light relative z-10 w-full max-w-md rounded-2xl bg-white p-5 text-slate-900 shadow-xl pointer-events-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-appointment-title"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="cancel-appointment-title" className="text-lg font-semibold text-slate-900">
              Cancelar turno
            </h2>
            {patientName ? <p className="mt-1 text-sm text-slate-500">{patientName}</p> : null}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            disabled={submitting}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleConfirm();
          }}
        >
          <Select
            label="Motivo de cancelación"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as CancellationCategory);
              setError(null);
            }}
            options={CANCEL_REASON_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            error={error ?? undefined}
          />
          <p className="text-xs text-slate-500">
            Quedará registrado en la agenda, historial y app del paciente.
          </p>
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" variant="danger" loading={submitting}>
              Confirmar cancelación
            </Button>
            <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
              Volver
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
