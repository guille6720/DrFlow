"use client";

import { X } from "lucide-react";
import { useState } from "react";

import {
  CANCELLATION_REASON_OPTIONS,
  type CancellationCategory,
} from "@/features/turnos/utils/appointment-lifecycle";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export type CancelAppointmentInput = {
  category: CancellationCategory;
};

interface CancelAppointmentDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (
    input: CancelAppointmentInput
  ) => Promise<void | { error?: string; success?: boolean }>;
  patientName?: string;
  loading?: boolean;
}

export function CancelAppointmentDialog({
  open,
  onClose,
  onConfirm,
  patientName,
  loading = false,
}: CancelAppointmentDialogProps) {
  const [category, setCategory] = useState<CancellationCategory>("clinic");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleConfirm() {
    setError(null);
    setSubmitting(true);
    try {
      const result = await onConfirm({ category });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setCategory("clinic");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar el turno");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting || loading) return;
    setCategory("clinic");
    setError(null);
    onClose();
  }

  const busy = submitting || loading;

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
            disabled={busy}
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
            options={CANCELLATION_REASON_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            error={error ?? undefined}
          />
          <p className="text-xs text-slate-500">
            Quedará registrado en la agenda, historial y app del paciente. Si el paciente tiene
            teléfono, podés avisarle por WhatsApp al confirmar.
          </p>
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" variant="danger" loading={busy}>
              Confirmar cancelación
            </Button>
            <Button type="button" variant="outline" onClick={handleClose} disabled={busy}>
              Volver
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
