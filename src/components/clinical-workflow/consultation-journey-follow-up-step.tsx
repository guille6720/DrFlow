"use client";

import { useMemo, useState } from "react";
import { addDays, setHours, setMinutes } from "date-fns";
import { Calendar, SkipForward } from "lucide-react";
import { AppointmentDatetimePicker } from "@/components/agenda/appointment-datetime-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { createAppointment } from "@/lib/actions/appointments";

const DEFAULT_APPOINTMENT_DURATION = 30;

function defaultFollowUpStartAt(): string {
  const base = setMinutes(setHours(addDays(new Date(), 30), 9), 0);
  return new Date(base.getTime() - base.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

type Props = {
  patientId: string;
  professionalId?: string;
  onScheduled: () => void;
  onSkip: () => void;
};

export function ConsultationJourneyFollowUpStep({
  patientId,
  professionalId,
  onScheduled,
  onSkip,
}: Props) {
  const [startAt, setStartAt] = useState(defaultFollowUpStartAt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("Control de seguimiento");

  const duration = useMemo(() => DEFAULT_APPOINTMENT_DURATION, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!professionalId) {
      setError("Seleccioná un profesional para agendar el turno.");
      return;
    }
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("patient_id", patientId);
    formData.set("professional_id", professionalId);
    formData.set("status", "pending");
    const start = new Date(startAt);
    const end = new Date(start.getTime() + duration * 60000);
    formData.set("start_at", startAt);
    formData.set("end_at", end.toISOString());
    formData.set("duration", String(duration));
    formData.set("notes", notes);

    const result = await createAppointment(formData);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onScheduled();
  }

  return (
    <Card title="Próximo turno">
      <p className="mb-4 text-sm text-slate-600">
        Agendá el control de seguimiento sin salir de la consulta. Podés omitir este paso si no
        corresponde.
      </p>

      {!professionalId ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          No hay profesional vinculado al turno actual. Omití este paso o volvé a evolución para
          verificar la firma del profesional.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-4">
        <input type="hidden" name="patient_id" value={patientId} />
        {professionalId ? <input type="hidden" name="professional_id" value={professionalId} /> : null}

        <AppointmentDatetimePicker
          value={startAt}
          onChange={setStartAt}
          required
          label="Fecha y hora del control"
        />

        <Input
          name="duration"
          label="Duración (min)"
          type="number"
          defaultValue={duration}
          required
        />

        <Input
          name="notes"
          label="Motivo / notas"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Control de seguimiento"
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={loading} disabled={!professionalId}>
            <Calendar className="h-4 w-4" />
            Agendar turno
          </Button>
          <Button type="button" variant="outline" onClick={onSkip}>
            <SkipForward className="h-4 w-4" />
            Omitir
          </Button>
        </div>
      </form>
    </Card>
  );
}
