/** Jobs that count toward automations.max_active (pending + running only). */

export function countsTowardAutomationsMaxActive(
  jobType: string,
  payload?: Record<string, unknown> | null
): boolean {
  if (jobType === "send_reminder" && payload?.channel === "whatsapp") return true;
  if (jobType === "run_ai_task" && payload?.task === "proactive_followup") return true;
  return false;
}

export function isAutomationLikeClinicJobRow(row: {
  job_type: string;
  payload: unknown;
}): boolean {
  const payload =
    row.payload && typeof row.payload === "object"
      ? (row.payload as Record<string, unknown>)
      : null;
  return countsTowardAutomationsMaxActive(row.job_type, payload);
}
