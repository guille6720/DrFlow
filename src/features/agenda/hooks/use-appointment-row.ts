"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateAppointmentStatus } from "@/lib/actions/appointments";
import {
  buildAppointmentCancellationByClinicMessage,
  buildAppointmentConfirmationMessage,
} from "@/lib/utils/appointment-messages";
import { buildWhatsAppUrl } from "@/shared/utils/whatsapp";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";
import type { Appointment } from "@/types/database";

export function useAppointmentRow(appointment: Appointment) {
  const router = useRouter();
  const [acting, setActing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

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
        : "Cancelado por el consultorio"
      : null;

  return {
    acting,
    cancelOpen,
    setCancelOpen,
    patient,
    setStatus,
    handleCancelConfirm,
    startHref,
    cancelledByLabel,
  };
}
