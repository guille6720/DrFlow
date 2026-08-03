import type { SupabaseClient } from "@supabase/supabase-js";
import { reminderService } from "@/lib/services/reminders";
import type { ClinicJobRow, SendReminderJobPayload } from "@/lib/jobs/types";

export async function handleSendReminderJob(
  supabase: SupabaseClient,
  job: ClinicJobRow
): Promise<Record<string, unknown>> {
  const payload = job.payload as unknown as SendReminderJobPayload;

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
