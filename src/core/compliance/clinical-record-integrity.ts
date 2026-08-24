import type { SupabaseClient } from "@supabase/supabase-js";

import { buildClinicalRecordAuditRow } from "@/core/security/audit-log";
import type { AuditAction } from "@/core/security/audit-types";

/** SOAP + structured fields tracked for HC integrity / version diffs. */
export const CLINICAL_RECORD_VERSIONED_FIELDS = [
  "chief_complaint",
  "diagnosis",
  "evolution",
  "indications",
  "diagnosis_cie10",
  "diagnoses_json",
  "treatments_json",
  "consultation_modality",
  "record_version",
] as const;

export type ClinicalRecordVersionedField = (typeof CLINICAL_RECORD_VERSIONED_FIELDS)[number];

const FIELD_LABELS_ES: Record<string, string> = {
  chief_complaint: "Motivo de consulta",
  diagnosis: "Diagnóstico",
  evolution: "Evolución",
  indications: "Indicaciones",
  diagnosis_cie10: "CIE-10",
  diagnoses_json: "Diagnósticos estructurados",
  treatments_json: "Tratamientos estructurados",
  consultation_modality: "Modalidad",
  record_version: "Versión",
  professional_id: "Profesional",
  appointment_id: "Turno",
};

export function clinicalRecordFieldLabel(field: string): string {
  return FIELD_LABELS_ES[field] ?? field.replace(/_/g, " ");
}

export function extractRecordVersion(snapshot: Record<string, unknown> | null | undefined): number | null {
  if (!snapshot) return null;
  const version = snapshot.record_version;
  return typeof version === "number" && Number.isFinite(version) ? version : null;
}

/** Human-readable list of changed HC fields between audit snapshots. */
export function summarizeClinicalRecordChanges(
  oldValues: Record<string, unknown> | null | undefined,
  newValues: Record<string, unknown> | null | undefined
): string[] {
  const labels: string[] = [];
  for (const field of CLINICAL_RECORD_VERSIONED_FIELDS) {
    const before = oldValues?.[field];
    const after = newValues?.[field];
    if (JSON.stringify(before ?? null) !== JSON.stringify(after ?? null)) {
      labels.push(clinicalRecordFieldLabel(field));
    }
  }
  return labels;
}

export type ClinicalRecordImportAuditSource =
  | "legacy_pdf_import"
  | "clinical_csv_import"
  | "hce_batch_import"
  | "fhir_import"
  | "teams_jsonl_import"
  | "structured_patch";

export async function insertClinicalRecordCreationAudit(
  supabase: SupabaseClient,
  input: {
    clinicalRecordId: string;
    clinicId: string;
    patientId: string;
    changedBy: string;
    source: ClinicalRecordImportAuditSource;
    marker?: string | null;
    what?: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }
): Promise<void> {
  const row = buildClinicalRecordAuditRow({
    clinicalRecordId: input.clinicalRecordId,
    clinicId: input.clinicId,
    patientId: input.patientId,
    action: "create",
    what: input.what ?? "Importó consulta clínica",
    changedBy: input.changedBy,
    newValues: {
      source: input.source,
      marker: input.marker ?? null,
      record_version: 1,
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  await supabase.from("clinical_record_audit").insert(row);
}

export async function insertClinicalRecordPatchAudit(
  supabase: SupabaseClient,
  input: {
    clinicalRecordId: string;
    clinicId: string;
    patientId: string;
    changedBy: string;
    action?: AuditAction;
    what: string;
    oldValues: Record<string, unknown>;
    newValues: Record<string, unknown>;
    changeReason?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }
): Promise<void> {
  const row = {
    ...buildClinicalRecordAuditRow({
      clinicalRecordId: input.clinicalRecordId,
      clinicId: input.clinicId,
      patientId: input.patientId,
      action: input.action ?? "update",
      what: input.what,
      changedBy: input.changedBy,
      oldValues: input.oldValues,
      newValues: input.newValues,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    }),
    change_reason: input.changeReason?.trim() || null,
  };

  await supabase.from("clinical_record_audit").insert(row);
}
