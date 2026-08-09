"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowRight, X } from "lucide-react";
import { useMemo, useState } from "react";

import type { AppointmentAgendaRow } from "@/core/supabase/query-types";

import { AppointmentDatetimePicker } from "@/features/agenda/components/agenda/appointment-datetime-picker";
import { rescheduleAppointment } from "@/features/turnos/actions/reschedule-appointment";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  appointment: AppointmentAgendaRow;
  appointments: AppointmentAgendaRow[];
  scheduleBlocks: { start_at: string; end_at: string; reason: string | null }[];
  defaultDuration: number;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

function toLocalDatetimeValue(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function durationMinutes(startAt: string, endAt: string) {
  return Math.max(15, Math.round((parseISO(endAt).getTime() - parseISO(startAt).getTime()) / 60000));
}

export function RescheduleAppointmentDialog({
  appointment,
  appointments,
  scheduleBlocks,
  defaultDuration,
  open,
  onClose,
  onSaved,
}: Props) {
  const [startAt, setStartAt] = useState(() => toLocalDatetimeValue(appointment.start_at));
  const [duration, setDuration] = useState(() =>
    durationMinutes(appointment.start_at, appointment.end_at)
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const newStartIso = useMemo(() => new Date(startAt).toISOString(), [startAt]);
  const newEndIso = useMemo(
    () => new Date(new Date(startAt).getTime() + duration * 60000).toISOString(),
    [startAt, duration]
  );

  const changed =
    newStartIso !== appointment.start_at || newEndIso !== appointment.end_at;

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!changed) {
      setError("Elegí una fecha u hora distinta");
      return;
    }

    setLoading(true);
    setError(null);

    const result = await rescheduleAppointment({
      appointment_id: appointment.id,
      start_at: newStartIso,
      end_at: newEndIso,
      reason: reason.trim() || undefined,
    });

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    onSaved();
    onClose();
  }

  function handleClose() {
    if (loading) return;
    onClose();
  }

  const otherAppointments = appointments.filter((a) => a.id !== appointment.id);
  const patient = appointment.patients as { first_name: string; last_name: string } | undefined;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50"
        aria-label="Cerrar"
        onClick={handleClose}
      />
      <div className="drflow-card-light relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 text-slate-900 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Reprogramar turno</h2>
            {patient ? (
              <p className="mt-1 text-sm text-slate-500">
                {patient.last_name}, {patient.first_name}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actual</p>
            <p className="font-medium">
              {format(parseISO(appointment.start_at), "EEE d MMM yyyy · HH:mm 'hs'", { locale: es })}
            </p>
          </div>
          <ArrowRight className="mx-auto hidden h-5 w-5 text-slate-400 sm:block" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nuevo</p>
            <p className={`font-medium ${changed ? "text-orange-700" : "text-slate-400"}`}>
              {format(parseISO(newStartIso), "EEE d MMM yyyy · HH:mm 'hs'", { locale: es })}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AppointmentDatetimePicker
            key={`reschedule-${appointment.id}-${startAt}`}
            value={startAt}
            onChange={setStartAt}
            appointments={otherAppointments}
            scheduleBlocks={scheduleBlocks}
            professionalId={appointment.professional_id}
            required
          />
          <Input
            label="Duración (min)"
            type="number"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value, 10) || defaultDuration)}
            min={15}
            step={5}
            required
          />
          <Textarea
            label="Motivo (opcional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Ej: El paciente solicitó otro horario"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" loading={loading} disabled={!changed}>
              Confirmar reprogramación
            </Button>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
