"use client";

export type PersistClinicalRecordInput = {
  recordId?: string | null;
  consultation_modality?: string;
  patient_id: string;
  appointment_id?: string | null;
  professional_id: string;
  chief_complaint?: string;
  diagnosis?: string;
  evolution?: string;
  indications?: string;
  professional_signature?: string;
  consultation_at?: string | null;
  diagnosis_cie10?: string | null;
  diagnoses_json?: string | null;
  treatments_json?: string | null;
};

export type PersistClinicalRecordResult =
  | { success: true; data: { id: string }; v?: string }
  | { error: string; v?: string };

/** Persist clinical record via API — no server actions (avoids RSC refresh crash). */
export async function persistClinicalRecordRequest(
  input: PersistClinicalRecordInput,
  init?: Pick<RequestInit, "keepalive">
): Promise<PersistClinicalRecordResult> {
  const response = await fetch("/api/clinical-records/persist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    keepalive: init?.keepalive ?? false,
    body: JSON.stringify(input),
  });

  let data: PersistClinicalRecordResult;
  try {
    data = (await response.json()) as PersistClinicalRecordResult;
  } catch {
    return { error: `No se pudo guardar la consulta (HTTP ${response.status})` };
  }

  if ("error" in data) {
    return {
      error: data.error || `No se pudo guardar la consulta (HTTP ${response.status})`,
      v: data.v,
    };
  }
  if (!response.ok || !data.success) {
    return { error: `No se pudo guardar la consulta (HTTP ${response.status})` };
  }
  return data;
}
