import type { PrescriptionMedication } from "@/types/prescription";

export type PrescriptionReusePrefill = {
  medications: PrescriptionMedication[];
  diagnosis_cie10?: string | null;
  diagnosis_text?: string | null;
  notes?: string | null;
  patient_insurance?: string | null;
  sourcePrescriptionId?: string;
};

function storageKey(patientId: string): string {
  return `drflow-rx-reuse-${patientId}`;
}

/** Guarda prefill de reutilización (sessionStorage, una sola lectura). */
export function storePrescriptionReusePrefill(
  patientId: string,
  data: PrescriptionReusePrefill
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(patientId), JSON.stringify(data));
  } catch {
    // ignore quota / private mode
  }
}

/** Lee y elimina el prefill pendiente para este paciente. */
export function consumePrescriptionReusePrefill(
  patientId: string
): PrescriptionReusePrefill | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(patientId));
    if (!raw) return null;
    sessionStorage.removeItem(storageKey(patientId));
    return JSON.parse(raw) as PrescriptionReusePrefill;
  } catch {
    return null;
  }
}
