"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import type { AppointmentAgendaRow } from "@/core/supabase/query-types";

import { buildWhatsAppUrl } from "@/shared/utils/whatsapp";

import type { CancelAppointmentInput } from "@/features/agenda/components/agenda/cancel-appointment-dialog";
import { buildAppointmentConsultationUrl } from "@/features/pacientes/utils/patient-workspace-actions";
import { formatCancellationReason } from "@/features/turnos/utils/appointment-lifecycle";

import { updateAppointmentStatus } from "@/lib/actions/appointments";
import { buildAppointmentConfirmationMessage } from "@/lib/utils/appointment-messages";

type CancelApiResponse =
  | {
      success: true;
      whatsapp: { phone: string; startAt: string; reason: string } | null;
    }
  | { error: string };

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
      try {
        const result = await updateAppointmentStatus(
          appointment.id,
          status,
          cancellationReason,
          undefined,
          cancellationCategory
        );

        if (result.error) {
          return { error: result.error };
        }

        if (status === "confirmed" && result.whatsapp?.phone) {
          try {
            const message = buildAppointmentConfirmationMessage(result.whatsapp.startAt);
            const url = buildWhatsAppUrl(result.whatsapp.phone, message);
            if (url) window.open(url, "_blank", "noopener,noreferrer");
          } catch {
            // Non-blocking
          }
        }

        router.refresh();
        return { success: true as const };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : "No se pudo actualizar el turno",
        };
      } finally {
        setActing(false);
      }
    },
    [appointment.id, router]
  );

  const handleCancelConfirm = useCallback(
    async (input: CancelAppointmentInput) => {
      setActing(true);
      try {
        const response = await fetch("/api/appointments/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            appointmentId: appointment.id,
            category: input.category,
          }),
        });

        let data: CancelApiResponse;
        try {
          data = (await response.json()) as CancelApiResponse;
        } catch {
          return { error: `No se pudo cancelar el turno (HTTP ${response.status})` };
        }

        if ("error" in data) {
          return {
            error: data.error || `No se pudo cancelar el turno (HTTP ${response.status})`,
          };
        }
        if (!response.ok) {
          return { error: `No se pudo cancelar el turno (HTTP ${response.status})` };
        }

        const whatsapp = data.whatsapp;
        if (whatsapp?.phone) {
          try {
            const when = new Date(whatsapp.startAt);
            const dateLabel = Number.isNaN(when.getTime())
              ? whatsapp.startAt
              : when.toLocaleString("es-AR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
            const message = [
              `Le informamos que su turno del ${dateLabel} fue cancelado por el consultorio.`,
              `Motivo: ${whatsapp.reason}`,
              "Podés solicitar un nuevo turno desde la App.",
            ].join(" ");
            const url = buildWhatsAppUrl(whatsapp.phone, message);
            if (url) window.open(url, "_blank", "noopener,noreferrer");
          } catch {
            // Non-blocking — cancellation already persisted.
          }
        }

        return { success: true as const };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : "No se pudo cancelar el turno",
        };
      } finally {
        setActing(false);
        try {
          router.refresh();
        } catch {
          // Non-blocking
        }
      }
    },
    [appointment.id, router]
  );

  const openCancelDialog = useCallback(() => setCancelOpen(true), []);
  const closeCancelDialog = useCallback(() => setCancelOpen(false), []);

  const startHref = buildAppointmentConsultationUrl(appointment.patient_id, {
    appointmentId: appointment.id,
    professionalId: appointment.professional_id,
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
