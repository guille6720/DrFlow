"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { toast } from "@/core/notifications/toast";

import { cn } from "@/shared/utils/cn";

import { clearConsultationTimer } from "@/features/historias/components/historias/consultation-timer";
import { buildAppointmentConsultationUrl } from "@/features/pacientes/utils/patient-workspace-actions";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { finalizeConsultation } from "@/lib/actions/appointments";
import { updateWaitingRoomStatus } from "@/lib/actions/waiting-room";
import type { ConsultationModality } from "@/lib/constants/consultation-modality";
import { CONSULTATION_MODALITY_OPTIONS } from "@/lib/constants/consultation-modality";

export type DoctorConsultaRow = {
  id: string;
  start_at: string;
  patient_id: string;
  professional_id: string;
  waiting_room_status: string | null;
  patients: {
    first_name: string;
    last_name: string;
    document_number?: string | null;
  } | null;
  professionals: {
    display_name: string | null;
    profiles: { full_name: string } | null;
  } | null;
};

type Props = {
  rows: DoctorConsultaRow[];
  highlightAppointmentId?: string | null;
};

function statusLabel(status: string | null): string {
  if (status === "in_consultation") return "En consulta";
  if (status === "confirmed") return "Confirmado / Presente";
  return status ?? "—";
}

export function DoctorConsultasView({ rows, highlightAppointmentId }: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [modalityById, setModalityById] = useState<Record<string, ConsultationModality>>({});
  const [isPending, startTransition] = useTransition();

  const ordered = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      if (a.id === highlightAppointmentId) return -1;
      if (b.id === highlightAppointmentId) return 1;
      return parseISO(a.start_at).getTime() - parseISO(b.start_at).getTime();
    });
    return list;
  }, [rows, highlightAppointmentId]);

  async function handleFinalize(appointmentId: string) {
    setPendingId(appointmentId);
    const modality = modalityById[appointmentId] ?? "presencial";
    const result = await finalizeConsultation(appointmentId, modality);
    if (result.error) {
      toast.error(result.error);
      setPendingId(null);
      return;
    }
    try {
      await updateWaitingRoomStatus(appointmentId, "finished");
    } catch {
      // Non-blocking — appointment already attended
    }
    clearConsultationTimer(appointmentId);
    setPendingId(null);
    startTransition(() => {
      router.refresh();
    });
  }

  if (ordered.length === 0) {
    return (
      <Card title="Consultas del día">
        <p className="text-sm text-slate-600">
          No hay pacientes confirmados ni en consulta ahora. Cuando marques{" "}
          <strong>Confirmar</strong> en Sala de espera, vas a llegar acá.
        </p>
        <Link href="/sala-espera" className="mt-3 inline-block">
          <Button type="button" variant="outline" size="sm">
            Ir a sala de espera
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {ordered.map((row) => {
        const patient = row.patients;
        const professional =
          row.professionals?.display_name ??
          row.professionals?.profiles?.full_name ??
          "Profesional";
        const name = patient
          ? `${patient.last_name}, ${patient.first_name}`
          : "Paciente";
        const consultHref = buildAppointmentConsultationUrl(row.patient_id, {
          appointmentId: row.id,
          professionalId: row.professional_id,
        });
        const highlighted = row.id === highlightAppointmentId;
        const busy = isPending || pendingId === row.id;

        return (
          <Card
            key={row.id}
            className={cn(highlighted && "ring-2 ring-teal-500")}
            title={name}
            description={`${format(parseISO(row.start_at), "HH:mm 'hs'", { locale: es })} · ${statusLabel(row.waiting_room_status)} · ${professional}`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1 text-sm text-slate-700">
                {patient?.document_number ? <p>DNI {patient.document_number}</p> : null}
                <p className="text-xs text-slate-500">Turno {row.id.slice(0, 8)}…</p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Link href={consultHref}>
                  <Button type="button" variant="outline" disabled={busy}>
                    <Stethoscope className="h-4 w-4" />
                    Abrir historia
                  </Button>
                </Link>
                <Select
                  label="Modalidad"
                  value={modalityById[row.id] ?? "presencial"}
                  onChange={(e) =>
                    setModalityById((prev) => ({
                      ...prev,
                      [row.id]: e.target.value as ConsultationModality,
                    }))
                  }
                  options={CONSULTATION_MODALITY_OPTIONS.map((item) => ({
                    value: item.value,
                    label: item.label,
                  }))}
                  className="min-w-[140px]"
                />
                <Button
                  type="button"
                  loading={busy}
                  onClick={() => void handleFinalize(row.id)}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Finalizar consulta
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
