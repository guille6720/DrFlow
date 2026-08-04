"use client";

import { Calendar, SkipForward } from "lucide-react";
import { AppointmentDatetimePicker } from "@/components/agenda/appointment-datetime-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useConsultationFollowUp } from "@/lib/hooks/use-consultation-follow-up";
import { FollowUpPhysicianAssist } from "@/components/clinical-workflow/follow-up-physician-assist";
import type { PhysicianAssistContext } from "@/lib/utils/physician-assist-types";

type Props = {
  patientId: string;
  professionalId?: string;
  assistContext: PhysicianAssistContext;
  onScheduled: () => void;
  onSkip: () => void;
};

/** Presentation-only follow-up scheduling step. */
export function ConsultationJourneyFollowUpStep({
  patientId,
  professionalId,
  assistContext,
  onScheduled,
  onSkip,
}: Props) {
  const followUp = useConsultationFollowUp({ patientId, professionalId, onScheduled });

  function applySuggestion(text: string) {
    const merged = followUp.notes.trim() ? `${followUp.notes.trim()}\n${text}` : text;
    followUp.setNotes(merged);
  }

  return (
    <Card title="Próximo turno">
      <p className="mb-4 text-sm text-slate-600">
        Agendá el control de seguimiento sin salir de la consulta. Podés omitir este paso si no
        corresponde.
      </p>

      <FollowUpPhysicianAssist
        context={{
          ...assistContext,
          evolutionText: assistContext.evolutionText ?? assistContext.lastEvolution ?? undefined,
        }}
        onApplyNotes={applySuggestion}
      />

      {!professionalId ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          No hay profesional vinculado al turno actual. Omití este paso o volvé a evolución para
          verificar la firma del profesional.
        </p>
      ) : null}

      <form onSubmit={followUp.handleSubmit} className="grid gap-4">
        <AppointmentDatetimePicker
          value={followUp.startAt}
          onChange={followUp.setStartAt}
          required
          label="Fecha y hora del control"
        />

        <Input
          name="duration"
          label="Duración (min)"
          type="number"
          defaultValue={followUp.duration}
          required
        />

        <Input
          name="notes"
          label="Motivo / notas"
          value={followUp.notes}
          onChange={(e) => followUp.setNotes(e.target.value)}
          placeholder="Control de seguimiento"
        />

        {followUp.error ? <p className="text-sm text-red-600">{followUp.error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={followUp.loading} disabled={!professionalId}>
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
