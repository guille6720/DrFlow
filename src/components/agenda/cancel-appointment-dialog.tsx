"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";

interface CancelAppointmentDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
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
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setError("Indicá el motivo (mín. 3 caracteres)");
      return;
    }
    setError(null);
    await onConfirm(trimmed);
    setReason("");
  }

  function handleClose() {
    if (loading) return;
    setReason("");
    setError(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50"
        aria-label="Cerrar"
        onClick={handleClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Cancelar turno</h2>
            {patientName && (
              <p className="mt-1 text-sm text-slate-500">{patientName}</p>
            )}
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
          <Textarea
            label="Motivo de cancelación"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError(null);
            }}
            placeholder="Ej: El médico no puede atender ese día"
            rows={3}
            required
            error={error ?? undefined}
          />
          <p className="text-xs text-slate-500">
            Quedará registrado en la agenda y en la app del paciente. Podés avisarle por WhatsApp.
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
