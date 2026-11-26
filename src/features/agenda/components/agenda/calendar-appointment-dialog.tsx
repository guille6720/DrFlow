"use client";

import { CalendarClock, Copy, Play, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { toast } from "@/core/notifications/toast";
import type { AppointmentAgendaRow } from "@/core/supabase/query-types";

import { formatClinicDateTime } from "@/shared/utils/clinic-timezone";
import {
  formatLabeledPatientDocument,
  formatPatientName,
  resolveAppointmentPatient,
} from "@/shared/utils/patient-display";

import { CancelAppointmentDialog } from "@/features/agenda/components/agenda/cancel-appointment-dialog";
import { ConfirmOnlineAppointmentButton } from "@/features/agenda/components/agenda/confirm-online-appointment-button";
import { TelemedicineJoinButton } from "@/features/agenda/components/agenda/telemedicine-join-button";
import { useAppointmentRow } from "@/features/agenda/hooks/use-appointment-row";
import { useClinicFeatures } from "@/features/plugins/components/plugins/clinic-features-provider";
import { demoBookingLink } from "@/features/portal/utils/demo-booking-link";
import { AppointmentLifecycleBadge } from "@/features/turnos/components/appointment-lifecycle-badge";

import { Button } from "@/components/ui/button";
import { getDemoBookingReceiptForStaff } from "@/lib/actions/public-booking";
import { canStartConsultation, isLaMejorDemoOnlineAppointment } from "@/lib/utils/appointment";

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
  const clinicFeatures = useClinicFeatures();
  const telemedicineEnabled = clinicFeatures.plugins.telemedicina;
  const isVirtual = appointment.consultation_modality === "virtual";
  const demoOnline = isLaMejorDemoOnlineAppointment(appointment);
  const pendingOnlineConfirmation = appointment.status === "pending" && demoOnline;
  const [copying, startCopy] = useTransition();
  const [receiptLink, setReceiptLink] = useState("");

  function copyTrackingLink() {
    startCopy(async () => {
      try {
        const result = await getDemoBookingReceiptForStaff(appointment.id);
        if (!result.receipt) {
          toast.error(result.error ?? "No pudimos generar el enlace.");
          return;
        }
        const link = demoBookingLink("nexclinic-demo-medica-15d", result.receipt);
        try {
          await navigator.clipboard.writeText(link);
          toast.success("Enlace de seguimiento copiado");
        } catch {
          setReceiptLink(link);
        }
      } catch {
        toast.error("No pudimos generar el enlace.");
      }
    });
  }

  const patient = resolveAppointmentPatient(appointment.patients);
  const patientName = formatPatientName(appointment.patients);
  const patientDocument = formatLabeledPatientDocument(patient ?? {});
  const professionalName =
    (appointment.professionals as { profiles?: { full_name?: string } } | undefined)?.profiles
      ?.full_name ?? null;

  const canModify =
    canManage &&
    appointment.status !== "cancelled" &&
    appointment.status !== "attended";

  function handleReschedule() {
    onReschedule?.(appointment);
    onClose();
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <>
      {!row.cancelOpen ? (
        <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50"
            aria-label="Cerrar"
            onClick={onClose}
          />
          <div className="drflow-modal-panel drflow-card-light relative z-10 w-full max-w-md rounded-2xl bg-white p-5 text-slate-900 shadow-xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 overflow-hidden">
              <h2 className="truncate text-lg font-semibold text-slate-900">{patientName}</h2>
              {patientDocument ? (
                <p className="mt-0.5 text-sm font-medium text-slate-600">{patientDocument}</p>
              ) : null}
              <p className="mt-1 text-sm text-slate-600">
                {formatClinicDateTime(appointment.start_at, "EEE d MMM yyyy · HH:mm 'hs'")}
              </p>
              {professionalName ? (
                <p className="mt-0.5 text-sm text-slate-500">{professionalName}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onClose();
              }}
              aria-label="Cerrar"
              className="relative z-10 shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-4">
            <AppointmentLifecycleBadge
              status={appointment.status}
              waitingRoomStatus={appointment.waiting_room_status}
              waitingRoomEnteredAt={appointment.waiting_room_entered_at}
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
            {telemedicineEnabled && isVirtual && canStartClinical && appointment.status !== "cancelled" ? (
              <TelemedicineJoinButton appointmentId={appointment.id} />
            ) : null}

            {canManage && pendingOnlineConfirmation ? (
              <ConfirmOnlineAppointmentButton appointment={appointment} onConfirmed={onClose} />
            ) : null}

            {canManage && demoOnline ? (
              <>
                <Button type="button" variant="outline" onClick={copyTrackingLink} loading={copying}>
                  <Copy aria-hidden="true" className="h-4 w-4" />
                  Copiar enlace de seguimiento
                </Button>
                {receiptLink && <input aria-label="Enlace de seguimiento" value={receiptLink} readOnly onFocus={(event) => event.target.select()} className="w-full rounded-lg border border-slate-200 p-2 text-xs" />}
              </>
            ) : null}

            {canStartClinical && !pendingOnlineConfirmation && canStartConsultation(appointment.status) ? (
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
      ) : null}

      {row.cancelOpen ? (
        <CancelAppointmentDialog
          key={`cancel-${appointment.id}`}
          open
          appointmentId={appointment.id}
          onClose={row.closeCancelDialog}
          onCancelled={onClose}
          patientName={patientName}
        />
      ) : null}
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
