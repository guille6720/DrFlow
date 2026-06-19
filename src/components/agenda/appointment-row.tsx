"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, appointmentStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CancelAppointmentDialog } from "@/components/agenda/cancel-appointment-dialog";
import { updateAppointmentStatus } from "@/lib/actions/clinic";
import { canStartConsultation, isOnlineBooking } from "@/lib/utils/appointment";
import {
  buildAppointmentCancellationByClinicMessage,
  buildAppointmentConfirmationMessage,
} from "@/lib/utils/appointment-messages";
import { buildWhatsAppUrl } from "@/lib/utils/whatsapp";
import type { Appointment } from "@/types/database";
import { isSameDay, parseISO } from "date-fns";
import { formatClinicDateTime } from "@/lib/utils/clinic-timezone";
import { Globe, Play, User } from "lucide-react";

interface Props {
  appointment: Appointment;
  showDate?: boolean;
  canManage: boolean;
  canStartClinical: boolean;
}

export function AppointmentRow({
  appointment,
  showDate = false,
  canManage,
  canStartClinical,
}: Props) {
  const router = useRouter();
  const [acting, setActing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const statusInfo = appointmentStatusBadge[appointment.status];
  const online = isOnlineBooking(appointment);
  const patient = appointment.patients as
    | { first_name: string; last_name: string; phone?: string | null }
    | undefined;

  async function setStatus(status: string, cancellationReason?: string) {
    setActing(true);
    const result = await updateAppointmentStatus(appointment.id, status, cancellationReason);
    setActing(false);

    if (result.error) return;

    if (status === "confirmed" && result.whatsapp?.phone) {
      const message = buildAppointmentConfirmationMessage(result.whatsapp.startAt);
      const url = buildWhatsAppUrl(result.whatsapp.phone, message);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    }

    if (status === "cancelled" && cancellationReason && patient?.phone) {
      const message = buildAppointmentCancellationByClinicMessage(
        appointment.start_at,
        cancellationReason
      );
      const url = buildWhatsAppUrl(patient.phone, message);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    }

    router.refresh();
  }

  async function handleCancelConfirm(reason: string) {
    setActing(true);
    await setStatus("cancelled", reason);
    setActing(false);
    setCancelOpen(false);
  }

  const startHref = `/historias/nueva?patient=${appointment.patient_id}&appointment=${appointment.id}&professional=${appointment.professional_id}`;

  const cancelledByLabel =
    appointment.status === "cancelled"
      ? appointment.cancelled_by_type === "patient"
        ? "Cancelado por el paciente"
        : "Cancelado por el consultorio"
      : null;

  return (
    <>
      <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-slate-900">
              {patient ? `${patient.last_name}, ${patient.first_name}` : "Paciente"}
            </p>
            {online && (
              <Badge variant="info" className="gap-1">
                <Globe className="h-3 w-3" />
                Web
              </Badge>
            )}
            {statusInfo && <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>}
          </div>
          <p className="text-sm text-slate-500">
            {showDate
              ? formatClinicDateTime(appointment.start_at, "PPp")
              : formatClinicDateTime(appointment.start_at, "HH:mm 'hs'")}
            {(appointment.professionals as { profiles?: { full_name?: string } } | undefined)
              ?.profiles?.full_name
              ? ` · ${(appointment.professionals as { profiles?: { full_name?: string } }).profiles?.full_name}`
              : ""}
          </p>
          {appointment.notes && (
            <p className="mt-1 text-xs text-slate-500">{appointment.notes}</p>
          )}
          {appointment.status === "cancelled" && (
            <p className="mt-1 text-xs text-red-700">
              {cancelledByLabel}
              {appointment.cancellation_reason
                ? ` · ${appointment.cancellation_reason}`
                : ""}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={`/pacientes/${appointment.patient_id}`}>
            <Button type="button" size="sm" variant="outline">
              <User className="h-3.5 w-3.5" />
              Ficha
            </Button>
          </Link>

          {canStartClinical && canStartConsultation(appointment.status) && (
            <Link href={startHref}>
              <Button type="button" size="sm">
                <Play className="h-3.5 w-3.5" />
                Empezar consulta
              </Button>
            </Link>
          )}

          {canManage && appointment.status === "pending" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              loading={acting}
              onClick={() => setStatus("confirmed")}
            >
              Confirmar
            </Button>
          )}

          {canManage &&
            appointment.status !== "cancelled" &&
            appointment.status !== "attended" && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  loading={acting}
                  onClick={() => setStatus("no_show")}
                >
                  Ausente
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  loading={acting}
                  onClick={() => setCancelOpen(true)}
                >
                  Cancelar
                </Button>
              </>
            )}
        </div>
      </li>

      <CancelAppointmentDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancelConfirm}
        patientName={
          patient ? `${patient.last_name}, ${patient.first_name}` : undefined
        }
        loading={acting}
      />
    </>
  );
}

export function filterAppointmentsForDay(appointments: Appointment[], day: Date) {
  return appointments
    .filter((a) => isSameDay(parseISO(a.start_at), day))
    .sort((a, b) => parseISO(a.start_at).getTime() - parseISO(b.start_at).getTime());
}
