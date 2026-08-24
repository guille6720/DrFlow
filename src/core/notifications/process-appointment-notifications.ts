import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { canUseFeatureAsSystem } from "@/core/entitlements/entitlements.server";
import { FEATURES } from "@/core/entitlements/features";
import { consumeAddonUsageAsSystem } from "@/core/entitlements/metered.server";
import { buildAppointmentNotificationMessage } from "@/core/notifications/appointment-notification-message";

import { sendTransactionalEmail } from "@/lib/services/transactional-email";
import { deliverWhatsAppMessage } from "@/lib/services/whatsapp-message";
import type { ReminderChannel, ReminderStatus } from "@/types/database";

export type AppointmentNotificationRow = {
  id: string;
  clinic_id: string;
  appointment_id: string;
  event_type: string;
  channel: ReminderChannel;
  recipient: string;
  payload: Record<string, unknown>;
};

export type SendAppointmentNotificationResult = {
  status: ReminderStatus;
  errorMessage?: string;
};

export async function sendAppointmentNotification(
  row: AppointmentNotificationRow
): Promise<SendAppointmentNotificationResult> {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  const { subject, text } = buildAppointmentNotificationMessage({
    eventType: row.event_type,
    channel: row.channel,
    payload: payload as {
      patient_name?: string;
      professional_name?: string;
      clinic_name?: string;
      start_at?: string;
      end_at?: string;
      from_start_at?: string;
      to_start_at?: string;
    },
  });

  if (row.channel === "email") {
    const result = await sendTransactionalEmail({
      to: row.recipient,
      subject,
      text,
    });

    if (result.sent) {
      return { status: "sent" };
    }

    return {
      status: "failed",
      errorMessage: result.reason ?? "No se pudo enviar el email",
    };
  }

  if (row.channel === "whatsapp") {
    if (
      !(await canUseFeatureAsSystem({
        clinicId: row.clinic_id,
        featureKey: FEATURES.WHATSAPP,
      }))
    ) {
      return {
        status: "failed",
        errorMessage: "WhatsApp no está incluido en el plan del consultorio.",
      };
    }

    const quota = await consumeAddonUsageAsSystem({
      clinicId: row.clinic_id,
      featureKey: FEATURES.WHATSAPP_MONTHLY_MESSAGES,
    });
    if (!quota.ok) {
      return { status: "failed", errorMessage: quota.error };
    }

    const result = await deliverWhatsAppMessage({
      to: row.recipient,
      text,
    });

    if (result.status === "sent") {
      return { status: "sent" };
    }

    if (result.status === "manual") {
      return {
        status: "simulated",
        errorMessage: "WhatsApp manual — abrí el chat desde Recordatorios para enviar el mensaje.",
      };
    }

    return {
      status: "failed",
      errorMessage: result.errorMessage ?? "No se pudo enviar WhatsApp",
    };
  }

  return { status: "simulated" };
}

export async function processAppointmentNotifications(
  supabase: SupabaseClient,
  options?: { limit?: number }
): Promise<{ processed: number; sent: number; failed: number }> {
  const limit = options?.limit ?? 10;

  const { data: claimed, error: claimError } = await supabase.rpc("claim_appointment_notifications", {
    p_limit: limit,
  });

  if (claimError) {
    throw new Error(claimError.message);
  }

  const rows = (claimed ?? []) as AppointmentNotificationRow[];
  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const result = await sendAppointmentNotification(row);
      await supabase.rpc("complete_appointment_notification", {
        p_id: row.id,
        p_status: result.status,
        p_error_message: result.errorMessage ?? null,
      });

      if (result.status === "failed") {
        failed += 1;
      } else {
        sent += 1;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      await supabase.rpc("complete_appointment_notification", {
        p_id: row.id,
        p_status: "failed",
        p_error_message: message,
      });
      failed += 1;
    }
  }

  return { processed: rows.length, sent, failed };
}
