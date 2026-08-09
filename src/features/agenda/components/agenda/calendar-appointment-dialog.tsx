"use client";

import { CalendarClock, Play, Trash2, X } from "lucide-react";
import Link from "next/link";

import { toast } from "@/core/notifications/toast";
import type { AppointmentAgendaRow } from "@/core/supabase/query-types";

import { formatClinicDateTime } from "@/shared/utils/clinic-timezone";

import { CancelAppointmentDialog } from "@/features/agenda/components/agenda/cancel-appointment-dialog";
import { useAppointmentRow } from "@/features/agenda/hooks/use-appointment-row";
import { AppointmentLifecycleBadge } from "@/features/turnos/components/appointment-lifecycle-badge";

import { Button } from "@/components/ui/button";
import { canStartConsultation } from "@/lib/utils/appointment";

type Props = {
  appointment: AppointmentAgendaRow;
  onClose: () => void;
  canManage: boolean;
  canStartClinical: boolean;
  onReschedule?: (appointment: AppointmentAgendaRow) => void;
};

function CalendarAppointmentDialogContent({
  appointment,
  onClose,
  canManage,
  canStartClinical,
  onReschedule,
}: Props) {
  const row = useAppointmentRow(appointment);

  const patient = row.patient;
  const patientName = patient ? `${patient.last_name}, ${patient.first_name}` : "Paciente";
  const professionalName =
    (appointment.professionals as { profiles?: { full_name?: string } } | undefined)?.profiles
      ?.full_name ?? null;

  const canModify =
    canManage &&
    appointment.status !== "cancelled" &&
    appointment.status !== "attended";

  async function handleCancelConfirm(input: Parameters<typeof row.handleCancelConfirm>[0]) {
    await row.handleCancelConfirm(input);
    toast.success("Turno cancelado");
    onClose();
  }

  function handleReschedule() {
    onReschedule?.(appointment);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center">
        <button
          type="button"
          className="absolute inset-0 bg-slate-900/50"
          aria-label="Cerrar"
          onClick={onClose}
        />
        <div className="drflow-card-light relative z-10 w-full max-w-md rounded-2xl bg-white p-5 text-slate-900 shadow-xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900">{patientName}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {formatClinicDateTime(appointment.start_at, "EEE d MMM yyyy · HH:mm 'hs'")}
              </p>
              {professionalName ? (
                <p className="mt-0.5 text-sm text-slate-500">{professionalName}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-4">
            <AppointmentLifecycleBadge
              status={appointment.status}
              waitingRoomStatus={appointment.waiting_room_status}
              isOverbooking={appointment.is_overbooking ?? false}
              rescheduledAt={appointment.rescheduled_at}
            />
            {appointment.status === "cancelled" && row.cancelledByLabel ? (
              <p className="mt-2 text-sm text-red-700">{row.cancelledByLabel}</p>
            ) : null}
            {appointment.notes ? (
              <p className="mt-2 text-sm text-slate-600">{appointment.notes}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            {canStartClinical && canStartConsultation(appointment.status) ? (
              <Link href={row.startHref} onClick={onClose}>
                <Button type="button" className="w-full">
                  <Play className="mr-1 h-4 w-4" />
                  Abrir historia clínica
                </Button>
              </Link>
            ) : null}

            {canModify && onReschedule ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleReschedule}
              >
                <CalendarClock className="mr-1 h-4 w-4" />
                Reprogramar
              </Button>
            ) : null}

            {canModify ? (
              <Button
                type="button"
                variant="danger"
                className="w-full"
                loading={row.acting}
                onClick={row.openCancelDialog}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Cancelar turno
              </Button>
            ) : null}

            <Button type="button" variant="ghost" className="w-full" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </div>

      <CancelAppointmentDialog
        open={row.cancelOpen}
        onClose={row.closeCancelDialog}
        onConfirm={handleCancelConfirm}
        patientName={patientName}
        loading={row.acting}
      />
    </>
  );
}

export function CalendarAppointmentDialog({
  appointment,
  open,
  onClose,
  canManage,
  canStartClinical,
  onReschedule,
}: {
  appointment: AppointmentAgendaRow | null;
  open: boolean;
  onClose: () => void;
  canManage: boolean;
  canStartClinical: boolean;
  onReschedule?: (appointment: AppointmentAgendaRow) => void;
}) {
  if (!open || !appointment) return null;

  return (
    <CalendarAppointmentDialogContent
      appointment={appointment}
      onClose={onClose}
      canManage={canManage}
      canStartClinical={canStartClinical}
      onReschedule={onReschedule}
    />
  );
}
