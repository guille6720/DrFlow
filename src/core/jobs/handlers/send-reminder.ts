import type { SupabaseClient } from "@supabase/supabase-js";

import type { ClinicJobRow, SendReminderJobPayload } from "@/core/jobs/types";

import { deliverReminderEmail } from "@/lib/services/reminder-email";
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
