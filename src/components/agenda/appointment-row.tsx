"use client";

import Link from "next/link";
import { Badge, appointmentStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CancelAppointmentDialog } from "@/components/agenda/cancel-appointment-dialog";
import { AppointmentRowActions } from "@/components/agenda/appointment-row-actions";
import { useAppointmentRow } from "@/lib/hooks/use-appointment-row";
import { canStartConsultation, isOnlineBooking } from "@/lib/utils/appointment";
import type { Appointment } from "@/types/database";
import { isSameDay, parseISO } from "date-fns";
import { formatClinicDateTime } from "@/lib/utils/clinic-timezone";
import { Globe } from "lucide-react";

interface Props {
  appointment: Appointment;
  showDate?: boolean;
  canManage: boolean;
  canStartClinical: boolean;
  onEdit?: (appointment: Appointment) => void;
}

export function AppointmentRow({
  appointment,
  showDate = false,
  canManage,
  canStartClinical,
  onEdit,
}: Props) {
  const row = useAppointmentRow(appointment);
  const statusInfo = appointmentStatusBadge[appointment.status];
  const online = isOnlineBooking(appointment);

  return (
    <>
      <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">
              {row.patient ? `${row.patient.last_name}, ${row.patient.first_name}` : "Paciente"}
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
              {row.cancelledByLabel}
              {appointment.cancellation_reason
                ? ` · ${appointment.cancellation_reason}`
                : ""}
            </p>
          )}
        </div>

        <AppointmentRowActions
          appointment={appointment}
          canManage={canManage}
          canStartClinical={canStartClinical}
          onEdit={onEdit}
          acting={row.acting}
          startHref={row.startHref}
          setStatus={row.setStatus}
          onCancel={() => row.setCancelOpen(true)}
        />
      </li>

      <CancelAppointmentDialog
        open={row.cancelOpen}
        onClose={() => row.setCancelOpen(false)}
        onConfirm={row.handleCancelConfirm}
        patientName={
          row.patient ? `${row.patient.last_name}, ${row.patient.first_name}` : undefined
        }
        loading={row.acting}
      />
    </>
  );
}

export function filterAppointmentsForDay(appointments: Appointment[], day: Date) {
  return appointments
    .filter((a) => isSameDay(parseISO(a.start_at), day))
    .sort((a, b) => parseISO(a.start_at).getTime() - parseISO(b.start_at).getTime());
}
