/** Snapshot de consulta inline para precargar receta sin perder la evolución. */

export type InlineConsultPrescriptionSnapshot = {
  patientId: string;
  appointmentId?: string;
  professionalId?: string;
  diagnosis: string;
  indications: string;
  evolution: string;
  savedAt: string;
};

export function inlineConsultPrescriptionKey(
  patientId: string,
  appointmentId?: string | null
): string {
  if (appointmentId?.trim()) {
    return `drflow-inline-rx-appt-${appointmentId.trim()}`;
  }
  return `drflow-inline-rx-patient-${patientId}`;
}

export function saveInlineConsultPrescriptionSnapshot(
  snapshot: InlineConsultPrescriptionSnapshot
): void {
  if (typeof window === "undefined") return;
  try {
    const key = inlineConsultPrescriptionKey(snapshot.patientId, snapshot.appointmentId);
    sessionStorage.setItem(key, JSON.stringify(snapshot));
  } catch {
    /* quota / private mode */
  }
}

export function readInlineConsultPrescriptionSnapshot(
  patientId: string,
  appointmentId?: string | null
): InlineConsultPrescriptionSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(inlineConsultPrescriptionKey(patientId, appointmentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InlineConsultPrescriptionSnapshot;
    if (parsed.patientId !== patientId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearInlineConsultPrescriptionSnapshot(
  patientId: string,
  appointmentId?: string | null
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(inlineConsultPrescriptionKey(patientId, appointmentId));
  } catch {
    /* ignore */
  }
}
