import type { SupabaseClient } from "@supabase/supabase-js";

import { canUseFeatureAsSystem } from "@/core/entitlements/entitlements.server";
import { FEATURES } from "@/core/entitlements/features";
import { consumeAddonUsageAsSystem } from "@/core/entitlements/metered.server";
import type { ClinicJobRow, SendReminderJobPayload } from "@/core/jobs/types";

import { deliverReminderEmail } from "@/lib/services/reminder-email";
import { deliverReminderWhatsApp } from "@/lib/services/reminder-whatsapp";
import { reminderService } from "@/lib/services/reminders";

export async function handleSendReminderJob(
  supabase: SupabaseClient,
  job: ClinicJobRow
): Promise<Record<string, unknown>> {
  const payload = job.payload as unknown as SendReminderJobPayload;

  if (payload.channel === "email") {
    const delivery = await deliverReminderEmail({
      to: payload.recipient,
      message: payload.message,
    });

    if (payload.reminderLogId) {
      await supabase
        .from("reminder_logs")
        .update({
          status: delivery.status,
          sent_at: delivery.status === "sent" ? new Date().toISOString() : null,
          error_message: delivery.errorMessage ?? null,
        })
        .eq("id", payload.reminderLogId)
        .eq("clinic_id", job.clinic_id);
    }

    return {
      channel: payload.channel,
      status: delivery.status,
      recipient: payload.recipient,
      provider: delivery.provider ?? null,
      errorMessage: delivery.errorMessage ?? null,
    };
  }

  if (payload.channel === "whatsapp") {
    if (
      !(await canUseFeatureAsSystem({
        clinicId: job.clinic_id,
        featureKey: FEATURES.WHATSAPP,
      }))
    ) {
      if (payload.reminderLogId) {
        await supabase
          .from("reminder_logs")
          .update({
            status: "failed",
            error_message: "WhatsApp no está incluido en el plan del consultorio.",
          })
          .eq("id", payload.reminderLogId)
          .eq("clinic_id", job.clinic_id);
      }
      return {
        channel: payload.channel,
        status: "failed",
        recipient: payload.recipient,
        errorMessage: "WhatsApp no está incluido en el plan del consultorio.",
      };
    }

    if (
      !(await canUseFeatureAsSystem({
        clinicId: job.clinic_id,
        featureKey: FEATURES.WHATSAPP_REMINDERS,
      }))
    ) {
      if (payload.reminderLogId) {
        await supabase
          .from("reminder_logs")
          .update({
            status: "failed",
            error_message: "Los recordatorios WhatsApp no están incluidos en el plan del consultorio.",
          })
          .eq("id", payload.reminderLogId)
          .eq("clinic_id", job.clinic_id);
      }
      return {
        channel: payload.channel,
        status: "failed",
        recipient: payload.recipient,
        errorMessage: "Los recordatorios WhatsApp no están incluidos en el plan del consultorio.",
      };
    }

    const quota = await consumeAddonUsageAsSystem({
      clinicId: job.clinic_id,
      featureKey: FEATURES.WHATSAPP_MONTHLY_MESSAGES,
    });
    if (!quota.ok) {
      if (payload.reminderLogId) {
        await supabase
          .from("reminder_logs")
          .update({
            status: "failed",
            error_message: quota.error,
          })
          .eq("id", payload.reminderLogId)
          .eq("clinic_id", job.clinic_id);
      }

      return {
        channel: payload.channel,
        status: "failed",
        recipient: payload.recipient,
        errorMessage: quota.error,
      };
    }

    const delivery = await deliverReminderWhatsApp({
      to: payload.recipient,
      message: payload.message,
    });

    if (payload.reminderLogId) {
      await supabase
        .from("reminder_logs")
        .update({
          status: delivery.status,
          sent_at:
            delivery.status === "sent" || delivery.status === "simulated"
              ? new Date().toISOString()
              : null,
          error_message: delivery.errorMessage ?? null,
        })
        .eq("id", payload.reminderLogId)
        .eq("clinic_id", job.clinic_id);
    }

    return {
      channel: payload.channel,
      status: delivery.status,
      recipient: payload.recipient,
      deliveryMode: delivery.deliveryMode ?? null,
      whatsappUrl: delivery.whatsappUrl ?? null,
      messageId: delivery.messageId ?? null,
      errorMessage: delivery.errorMessage ?? null,
    };
  }

  const result = await reminderService.send({
    clinicId: job.clinic_id,
    appointmentId: payload.appointmentId,
    recipient: payload.recipient,
    channel: payload.channel,
    message: payload.message,
  });

  if (payload.reminderLogId) {
    await supabase
      .from("reminder_logs")
      .update({
        status: result.status,
        sent_at: result.sent_at,
        error_message: null,
      })
      .eq("id", payload.reminderLogId)
      .eq("clinic_id", job.clinic_id);
  }

  return {
    channel: result.channel,
    status: result.status,
    recipient: result.recipient,
  };
}
