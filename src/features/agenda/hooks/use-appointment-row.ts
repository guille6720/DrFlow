"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import type { AppointmentAgendaRow } from "@/core/supabase/query-types";

import { buildWhatsAppUrl } from "@/shared/utils/whatsapp";

import type { CancelAppointmentInput } from "@/features/agenda/components/agenda/cancel-appointment-dialog";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";
import { formatCancellationReason } from "@/features/turnos/utils/appointment-lifecycle";

import { updateAppointmentStatus } from "@/lib/actions/appointments";
import {
  buildAppointmentCancellationByClinicMessage,
  buildAppointmentConfirmationMessage,
} from "@/lib/utils/appointment-messages";

export function useAppointmentRow(appointment: AppointmentAgendaRow) {
  const router = useRouter();
  const [acting, setActing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const patient = appointment.patients as
    | { first_name: string; last_name: string; phone?: string | null }
    | undefined;

  const setStatus = useCallback(
    async (
      status: string,
      cancellationReason?: string,
      cancellationCategory?: string
    ) => {
      setActing(true);
      const result = await updateAppointmentStatus(
        appointment.id,
        status,
        cancellationReason,
        undefined,
        cancellationCategory
      );
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
    },
    [appointment.id, appointment.start_at, patient, router]
  );

  const handleCancelConfirm = useCallback(
    async (input: CancelAppointmentInput) => {
      const formatted = formatCancellationReason(input.category, input.detail);
      setActing(true);
      await setStatus("cancelled", formatted, input.category);
      setActing(false);
      setCancelOpen(false);
    },
    [setStatus]
  );

  const openCancelDialog = useCallback(() => setCancelOpen(true), []);
  const closeCancelDialog = useCallback(() => setCancelOpen(false), []);

  const startHref = buildPatientWorkspaceUrl(appointment.patient_id, {
    tab: "soap",
    action: "nueva",
    appointment: appointment.id,
    professional: appointment.professional_id,
  });

  const cancelledByLabel =
    appointment.status === "cancelled"
      ? appointment.cancelled_by_type === "patient"
        ? "Cancelado por el paciente"
        : appointment.cancellation_category
          ? formatCancellationReason(
              appointment.cancellation_category,
              appointment.cancellation_reason
            )
          : "Cancelado por el consultorio"
      : null;

  return useMemo(
    () => ({
      acting,
      cancelOpen,
      setCancelOpen,
      patient,
      setStatus,
      handleCancelConfirm,
      openCancelDialog,
      closeCancelDialog,
      startHref,
      cancelledByLabel,
    }),
    [
      acting,
      cancelOpen,
      patient,
      setStatus,
      handleCancelConfirm,
      openCancelDialog,
      closeCancelDialog,
      startHref,
      cancelledByLabel,
    ]
  );
}
