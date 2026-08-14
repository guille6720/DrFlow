"use client";

import { isSameDay, parseISO } from "date-fns";
import { Globe, Video } from "lucide-react";
import { memo } from "react";

import type { AppointmentAgendaRow } from "@/core/supabase/query-types";

import { formatClinicDateTime } from "@/shared/utils/clinic-timezone";

import { AppointmentRowActions } from "@/features/agenda/components/agenda/appointment-row-actions";
import { CancelAppointmentDialog } from "@/features/agenda/components/agenda/cancel-appointment-dialog";
import { TelemedicineJoinButton } from "@/features/agenda/components/agenda/telemedicine-join-button";
import { useAppointmentRow } from "@/features/agenda/hooks/use-appointment-row";
import { AppointmentLifecycleBadge } from "@/features/turnos/components/appointment-lifecycle-badge";

import { Badge } from "@/components/ui/badge";
import { isOnlineBooking } from "@/lib/utils/appointment";

interface Props {
  appointment: AppointmentAgendaRow;
  showDate?: boolean;
  canManage: boolean;
  canStartClinical: boolean;
  telemedicineEnabled?: boolean;
  onEdit?: (appointment: AppointmentAgendaRow) => void;
  onReschedule?: (appointment: AppointmentAgendaRow) => void;
}

export const AppointmentRow = memo(function AppointmentRow({
  appointment,
  showDate = false,
  canManage,
  canStartClinical,
  telemedicineEnabled = false,
  onEdit,
  onReschedule,
}: Props) {
  const row = useAppointmentRow(appointment);
  const online = isOnlineBooking(appointment);
  const isVirtual = appointment.consultation_modality === "virtual";

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
            {isVirtual && (
              <Badge variant="info" className="gap-1">
                <Video className="h-3 w-3" />
                Virtual
              </Badge>
            )}
            <AppointmentLifecycleBadge
              status={appointment.status}
              waitingRoomStatus={appointment.waiting_room_status}
              waitingRoomEnteredAt={appointment.waiting_room_entered_at}
              isOverbooking={appointment.is_overbooking ?? false}
              rescheduledAt={appointment.rescheduled_at}
            />
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
          {appointment.status === "cancelled" && row.cancelledByLabel ? (
            <p className="mt-1 text-xs text-red-700">{row.cancelledByLabel}</p>
          ) : null}
        </div>

        {telemedicineEnabled && isVirtual && canStartClinical && appointment.status !== "cancelled" ? (
          <TelemedicineJoinButton appointmentId={appointment.id} compact />
        ) : null}

        <AppointmentRowActions
          appointment={appointment}
          canManage={canManage}
          canStartClinical={canStartClinical}
          onEdit={onEdit}
          onReschedule={onReschedule}
          acting={row.acting}
          startHref={row.startHref}
          setStatus={row.setStatus}
          onCancel={row.openCancelDialog}
        />
      </li>

      {row.cancelOpen ? (
        <CancelAppointmentDialog
          key={`cancel-${appointment.id}`}
          open
          onClose={row.closeCancelDialog}
          onConfirm={async (input) => {
            const result = await row.handleCancelConfirm(input);
            if (result?.error) {
              return { error: result.error };
            }
            return { success: true as const };
          }}
          patientName={
            row.patient ? `${row.patient.last_name}, ${row.patient.first_name}` : undefined
          }
          loading={row.acting}
        />
      ) : null}
    </>
  );
});

export function filterAppointmentsForDay(appointments: AppointmentAgendaRow[], day: Date) {
  return appointments
    .filter((a) => isSameDay(parseISO(a.start_at), day))
    .sort((a, b) => parseISO(a.start_at).getTime() - parseISO(b.start_at).getTime());
}
