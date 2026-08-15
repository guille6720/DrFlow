"use server";

import { z } from "zod";

import { getSession } from "@/core/auth/session.server";
import { createClient } from "@/core/supabase/server";

import {
  type ClinicalFavoriteDiagnosisPayload,
  type ClinicalFavoriteKind,
  type ClinicalFavoriteMedicationPayload,
  type ClinicalFavoriteRow,
  type ClinicalFavoriteTreatmentPayload,
  diagnosisFavoriteFingerprint,
  medicationFavoriteFingerprint,
  treatmentFavoriteFingerprint,
} from "@/features/historias/types/clinical-favorites";

const kindSchema = z.enum(["diagnosis", "treatment", "medication"]);

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

function mapRow(row: Record<string, unknown>): ClinicalFavoriteRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    kind: row.kind as ClinicalFavoriteKind,
    fingerprint: String(row.fingerprint),
    label: String(row.label),
    payload: (row.payload ?? {}) as ClinicalFavoriteRow["payload"],
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function listClinicalFavorites(
  kind?: ClinicalFavoriteKind
): Promise<{ data?: ClinicalFavoriteRow[]; error?: string }> {
  const user = await getSession();
  if (!user) return { error: "Sesión requerida" };

  const supabase = await createClient();
  let query = supabase
    .from("clinical_favorites")
    .select("id, user_id, kind, fingerprint, label, payload, sort_order, created_at, updated_at")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (kind) {
    const parsedKind = kindSchema.safeParse(kind);
    if (!parsedKind.success) return { error: "Tipo de favorito inválido" };
    query = query.eq("kind", parsedKind.data);
  }

  const { data, error } = await query.limit(100);
  if (error) {
    return { error: "No se pudieron cargar los favoritos." };
  }

  return { data: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)) };
}

export async function addDiagnosisFavorite(
  payload: ClinicalFavoriteDiagnosisPayload
): Promise<{ data?: ClinicalFavoriteRow; error?: string }> {
  const user = await getSession();
  if (!user) return { error: "Sesión requerida" };

  const parsed = diagnosisPayloadSchema.safeParse(payload);
  if (!parsed.success) return { error: "Diagnóstico inválido para favorito" };

  const fingerprint = diagnosisFavoriteFingerprint(parsed.data);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinical_favorites")
    .upsert(
      {
        user_id: user.id,
        kind: "diagnosis",
        fingerprint,
        label: parsed.data.name.trim(),
        payload: parsed.data,
      },
      { onConflict: "user_id,kind,fingerprint" }
    )
    .select("id, user_id, kind, fingerprint, label, payload, sort_order, created_at, updated_at")
    .single();

  if (error) return { error: "No se pudo guardar el diagnóstico favorito." };
  return { data: mapRow(data as Record<string, unknown>) };
}

export async function addTreatmentFavorite(
  payload: ClinicalFavoriteTreatmentPayload
): Promise<{ data?: ClinicalFavoriteRow; error?: string }> {
  const user = await getSession();
  if (!user) return { error: "Sesión requerida" };

  const parsed = treatmentPayloadSchema.safeParse(payload);
  if (!parsed.success) return { error: "Tratamiento inválido para favorito" };

  const fingerprint = treatmentFavoriteFingerprint(parsed.data);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinical_favorites")
    .upsert(
      {
        user_id: user.id,
        kind: "treatment",
        fingerprint,
        label: parsed.data.product.trim(),
        payload: parsed.data,
      },
      { onConflict: "user_id,kind,fingerprint" }
    )
    .select("id, user_id, kind, fingerprint, label, payload, sort_order, created_at, updated_at")
    .single();

  if (error) return { error: "No se pudo guardar el tratamiento favorito." };
  return { data: mapRow(data as Record<string, unknown>) };
}

export async function addMedicationFavorite(
  payload: ClinicalFavoriteMedicationPayload
): Promise<{ data?: ClinicalFavoriteRow; error?: string }> {
  const user = await getSession();
  if (!user) return { error: "Sesión requerida" };

  const parsed = medicationPayloadSchema.safeParse(payload);
  if (!parsed.success) return { error: "Medicamento inválido para favorito" };

  const fingerprint = medicationFavoriteFingerprint(parsed.data);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinical_favorites")
    .upsert(
      {
        user_id: user.id,
        kind: "medication",
        fingerprint,
        label:
          [parsed.data.brand_name?.trim(), parsed.data.generic_name.trim()]
            .filter(Boolean)
            .join(" · ") || parsed.data.generic_name.trim(),
        payload: parsed.data,
      },
      { onConflict: "user_id,kind,fingerprint" }
    )
    .select("id, user_id, kind, fingerprint, label, payload, sort_order, created_at, updated_at")
    .single();

  if (error) return { error: "No se pudo guardar el medicamento favorito." };
  return { data: mapRow(data as Record<string, unknown>) };
}

export async function removeClinicalFavorite(
  favoriteId: string
): Promise<{ ok?: true; error?: string }> {
  const user = await getSession();
  if (!user) return { error: "Sesión requerida" };

  const idParsed = z.string().uuid().safeParse(favoriteId);
  if (!idParsed.success) return { error: "Favorito inválido" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("clinical_favorites")
    .delete()
    .eq("id", idParsed.data)
    .eq("user_id", user.id);

  if (error) return { error: "No se pudo quitar el favorito." };
  return { ok: true };
}

export async function removeClinicalFavoriteByFingerprint(
  kind: ClinicalFavoriteKind,
  fingerprint: string
): Promise<{ ok?: true; error?: string }> {
  const user = await getSession();
  if (!user) return { error: "Sesión requerida" };

  const kindParsed = kindSchema.safeParse(kind);
  const fp = fingerprint.trim();
  if (!kindParsed.success || !fp) return { error: "Favorito inválido" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("clinical_favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("kind", kindParsed.data)
    .eq("fingerprint", fp);

  if (error) return { error: "No se pudo quitar el favorito." };
  return { ok: true };
}
