"use server";

import { z } from "zod";

import { getSession } from "@/core/auth/session.server";
import { createClient } from "@/core/supabase/server";

import {
  type ClinicalFavoriteDiagnosisPayload,
  type ClinicalFavoriteKind,
  type ClinicalFavoriteMedicationPayload,
  type ClinicalFavoriteTreatmentPayload,
  diagnosisFavoriteFingerprint,
  medicationFavoriteFingerprint,
  treatmentFavoriteFingerprint,
} from "@/features/historias/types/clinical-favorites";
import type { ClinicalRecentUsageRow } from "@/features/historias/types/clinical-recent-usage";

const kindSchema = z.enum(["diagnosis", "treatment", "medication"]);

const FORBIDDEN_PAYLOAD_KEYS = [
  "patient_id",
  "clinical_record_id",
  "patient_name",
  "documento",
  "dni",
  "notes",
  "evolution",
  "indications",
] as const;

const diagnosisPayloadSchema = z.object({
  name: z.string().trim().min(1).max(240),
  cie10_code: z.string().trim().max(32).nullable().optional(),
  cie11_code: z.string().trim().max(32).nullable().optional(),
  snomed_code: z.string().trim().max(64).nullable().optional(),
  clinical_diagnosis_id: z.string().uuid().nullable().optional(),
});

const treatmentPayloadSchema = z.object({
  product: z.string().trim().min(1).max(240),
  kind: z.string().trim().max(64).nullable().optional(),
  category: z.string().trim().max(120).nullable().optional(),
  clinical_treatment_id: z.string().uuid().nullable().optional(),
});

const medicationPayloadSchema = z.object({
  generic_name: z.string().trim().min(1).max(240),
  brand_name: z.string().trim().max(240).nullable().optional(),
  presentation: z.string().trim().max(240).nullable().optional(),
  concentration: z.string().trim().max(120).nullable().optional(),
  pharmaceutical_form: z.string().trim().max(120).nullable().optional(),
  vademecum_code: z.string().trim().max(64).nullable().optional(),
  active_ingredient: z.string().trim().max(240).nullable().optional(),
});

function assertNoSensitiveKeys(payload: Record<string, unknown>) {
  for (const key of FORBIDDEN_PAYLOAD_KEYS) {
    if (key in payload) {
      throw new Error("SENSITIVE_PAYLOAD_FORBIDDEN");
    }
  }
}

function mapRow(row: Record<string, unknown>): ClinicalRecentUsageRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    kind: row.kind as ClinicalFavoriteKind,
    fingerprint: String(row.fingerprint),
    label: String(row.label),
    payload: (row.payload ?? {}) as ClinicalRecentUsageRow["payload"],
    last_used_at: String(row.last_used_at),
    use_count: Number(row.use_count ?? 1),
    created_at: String(row.created_at),
  };
}

export async function listClinicalRecentUsage(
  kind?: ClinicalFavoriteKind,
  limit = 20
): Promise<{ data?: ClinicalRecentUsageRow[]; error?: string }> {
  const user = await getSession();
  if (!user) return { error: "Sesión requerida" };

  const supabase = await createClient();
  let query = supabase
    .from("clinical_recent_usage")
    .select("id, user_id, kind, fingerprint, label, payload, last_used_at, use_count, created_at")
    .eq("user_id", user.id)
    .order("last_used_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 40));

  if (kind) {
    const parsedKind = kindSchema.safeParse(kind);
    if (!parsedKind.success) return { error: "Tipo inválido" };
    query = query.eq("kind", parsedKind.data);
  }

  const { data, error } = await query;
  if (error) return { error: "No se pudo cargar el uso reciente." };
  return { data: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)) };
}

async function recordUsage(args: {
  kind: ClinicalFavoriteKind;
  fingerprint: string;
  label: string;
  payload: Record<string, unknown>;
}): Promise<{ data?: ClinicalRecentUsageRow; error?: string }> {
  const user = await getSession();
  if (!user) return { error: "Sesión requerida" };

  try {
    assertNoSensitiveKeys(args.payload);
  } catch {
    return { error: "No se pueden guardar datos sensibles en uso reciente." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_clinical_recent_usage", {
    p_kind: args.kind,
    p_fingerprint: args.fingerprint,
    p_label: args.label,
    p_payload: args.payload,
    p_keep_per_kind: 40,
  });

  if (error) return { error: "No se pudo registrar el uso reciente." };
  return { data: mapRow(data as Record<string, unknown>) };
}

export async function recordDiagnosisRecentUsage(
  payload: ClinicalFavoriteDiagnosisPayload
): Promise<{ data?: ClinicalRecentUsageRow; error?: string }> {
  const parsed = diagnosisPayloadSchema.safeParse(payload);
  if (!parsed.success) return { error: "Diagnóstico inválido" };
  return recordUsage({
    kind: "diagnosis",
    fingerprint: diagnosisFavoriteFingerprint(parsed.data),
    label: parsed.data.name.trim(),
    payload: parsed.data,
  });
}

export async function recordTreatmentRecentUsage(
  payload: ClinicalFavoriteTreatmentPayload
): Promise<{ data?: ClinicalRecentUsageRow; error?: string }> {
  const parsed = treatmentPayloadSchema.safeParse(payload);
  if (!parsed.success) return { error: "Tratamiento inválido" };
  return recordUsage({
    kind: "treatment",
    fingerprint: treatmentFavoriteFingerprint(parsed.data),
    label: parsed.data.product.trim(),
    payload: parsed.data,
  });
}

export async function recordMedicationRecentUsage(
  payload: ClinicalFavoriteMedicationPayload
): Promise<{ data?: ClinicalRecentUsageRow; error?: string }> {
  const parsed = medicationPayloadSchema.safeParse(payload);
  if (!parsed.success) return { error: "Medicamento inválido" };
  return recordUsage({
    kind: "medication",
    fingerprint: medicationFavoriteFingerprint(parsed.data),
    label:
      [parsed.data.brand_name?.trim(), parsed.data.generic_name.trim()]
        .filter(Boolean)
        .join(" · ") || parsed.data.generic_name.trim(),
    payload: parsed.data,
  });
}
