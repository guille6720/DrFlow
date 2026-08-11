import type { DbClient, RepoResult } from "@/core/repositories/types";
import { mapPostgresError, repoErr, repoOk } from "@/core/repositories/types";

import type { CoverageKind } from "@/features/recetas/engine/types";

import type { PrescriptionMedication } from "@/types/prescription";

export type PrescriptionTemplateRow = {
  id: string;
  clinic_id: string;
  professional_id: string | null;
  name: string;
  coverage_kind: CoverageKind | null;
  medications: PrescriptionMedication[];
  notes: string | null;
  diagnosis_cie10: string | null;
  diagnosis_text: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type PrescriptionTemplateInsertRow = {
  clinic_id: string;
  professional_id: string | null;
  name: string;
  coverage_kind: CoverageKind | null;
  medications: PrescriptionMedication[];
  notes: string | null;
  diagnosis_cie10: string | null;
  diagnosis_text: string | null;
  created_by: string;
};

const TEMPLATE_COLUMNS =
  "id, clinic_id, professional_id, name, coverage_kind, medications, notes, diagnosis_cie10, diagnosis_text, created_by, created_at, updated_at";

export async function listPrescriptionTemplatesForClinic(
  db: DbClient,
  clinicId: string,
  opts?: { professionalId?: string | null }
): Promise<RepoResult<PrescriptionTemplateRow[]>> {
  let query = db
    .from("prescription_templates")
    .select(TEMPLATE_COLUMNS)
    .eq("clinic_id", clinicId)
    .order("updated_at", { ascending: false });

  if (opts?.professionalId) {
    query = query.or(`professional_id.is.null,professional_id.eq.${opts.professionalId}`);
  }

  const { data, error } = await query;
  if (error) return repoErr(mapPostgresError(error));
  return repoOk((data ?? []) as PrescriptionTemplateRow[]);
}

export async function insertPrescriptionTemplate(
  db: DbClient,
  row: PrescriptionTemplateInsertRow
): Promise<RepoResult<PrescriptionTemplateRow>> {
  const { data, error } = await db
    .from("prescription_templates")
    .insert(row)
    .select(TEMPLATE_COLUMNS)
    .single();

  if (error) return repoErr(mapPostgresError(error));
  return repoOk(data as PrescriptionTemplateRow);
}

export async function updatePrescriptionTemplate(
  db: DbClient,
  templateId: string,
  clinicId: string,
  row: Partial<Omit<PrescriptionTemplateInsertRow, "clinic_id" | "created_by">>
): Promise<RepoResult<PrescriptionTemplateRow>> {
  const { data, error } = await db
    .from("prescription_templates")
    .update({ ...row, updated_at: new Date().toISOString() })
    .eq("id", templateId)
    .eq("clinic_id", clinicId)
    .select(TEMPLATE_COLUMNS)
    .maybeSingle();

  if (error) return repoErr(mapPostgresError(error));
  if (!data) return repoErr("Plantilla no encontrada.");
  return repoOk(data as PrescriptionTemplateRow);
}

export async function deletePrescriptionTemplate(
  db: DbClient,
  templateId: string,
  clinicId: string
): Promise<RepoResult<{ id: string }>> {
  const { data, error } = await db
    .from("prescription_templates")
    .delete()
    .eq("id", templateId)
    .eq("clinic_id", clinicId)
    .select("id")
    .maybeSingle();

  if (error) return repoErr(mapPostgresError(error));
  if (!data) return repoErr("Plantilla no encontrada.");
  return repoOk(data as { id: string });
}
