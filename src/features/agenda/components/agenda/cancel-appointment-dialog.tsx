"use client";

import { X } from "lucide-react";
import { useState } from "react";

import {
  CANCELLATION_REASON_OPTIONS,
  type CancellationCategory,
} from "@/features/turnos/utils/appointment-lifecycle";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type CancelAppointmentInput = {
  category: CancellationCategory;
  detail: string;
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
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = detail.trim();
    if (trimmed.length < 3) {
      setError("Indicá el motivo (mín. 3 caracteres)");
      return;
    }
    setError(null);
    const result = await onConfirm({ category, detail: trimmed });
    if (result?.error) {
      setError(result.error);
      return;
    }
    onClose();
  }

  function handleClose() {
    if (loading) return;
    setDetail("");
    setCategory("clinic");
    setError(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50"
        aria-label="Cerrar"
        onClick={handleClose}
      />
      <div className="drflow-card-light relative z-10 w-full max-w-md rounded-2xl bg-white p-5 text-slate-900 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Cancelar turno</h2>
            {patientName ? <p className="mt-1 text-sm text-slate-500">{patientName}</p> : null}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Motivo"
            value={category}
            onChange={(e) => setCategory(e.target.value as CancellationCategory)}
            options={CANCELLATION_REASON_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
          <Textarea
            label="Detalle"
            value={detail}
            onChange={(e) => {
              setDetail(e.target.value);
              setError(null);
            }}
            placeholder="Ej: El paciente avisó que no puede asistir"
            rows={3}
            error={error ?? undefined}
          />
          <p className="text-xs text-slate-500">
            Quedará registrado en la agenda, historial y app del paciente. Podés avisarle por
            WhatsApp.
          </p>
          <div className="flex gap-2">
            <Button type="submit" variant="danger" loading={loading}>
              Confirmar cancelación
            </Button>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Volver
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
