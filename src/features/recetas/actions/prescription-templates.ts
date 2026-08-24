"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { recordAudit } from "@/core/security/audit-service";
import { requireClinicalIssueAccess } from "@/core/services/clinical-access.service";
import { createClient } from "@/core/supabase/server";
import { entityIdSchema, firstZodIssue, optionalEntityIdSchema } from "@/core/validations/params";
import { prescriptionMedicationSchema } from "@/core/validations/schemas";

import { COVERAGE_KINDS } from "@/features/recetas/engine/types";
import {
  deletePrescriptionTemplate,
  insertPrescriptionTemplate,
  listPrescriptionTemplatesForClinic,
  type PrescriptionTemplateRow,
  updatePrescriptionTemplate,
} from "@/features/recetas/repositories/prescription-templates.repository";
import { parseMedicationsJson } from "@/features/recetas/services/prescriptions.service";

const templateFieldsSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres.").max(120),
  professional_id: optionalEntityIdSchema,
  coverage_kind: z.enum(COVERAGE_KINDS).optional().nullable(),
  medications: z.array(prescriptionMedicationSchema).min(1, "Agregá al menos un medicamento."),
  notes: z.string().max(2000).optional().nullable(),
  diagnosis_cie10: z.string().max(20).optional().nullable(),
  diagnosis_text: z.string().max(500).optional().nullable(),
});

function parseTemplateMedications(formData: FormData) {
  const raw = formData.get("medications_json");
  const parsed = parseMedicationsJson(raw);
  if (!Array.isArray(parsed)) return { error: "Medicamentos inválidos." as const };
  return { data: parsed };
}

function parseTemplateForm(
  formData: FormData
):
  | { ok: false; error: string }
  | { ok: true; data: z.infer<typeof templateFieldsSchema> } {
  const meds = parseTemplateMedications(formData);
  if ("error" in meds) return { ok: false, error: meds.error as string };

  const professionalRaw = String(formData.get("professional_id") ?? "").trim();
  const coverageRaw = String(formData.get("coverage_kind") ?? "").trim();

  const parsed = templateFieldsSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    professional_id: professionalRaw || null,
    coverage_kind: coverageRaw || null,
    medications: meds.data,
    notes: String(formData.get("notes") ?? "").trim() || null,
    diagnosis_cie10: String(formData.get("diagnosis_cie10") ?? "").trim() || null,
    diagnosis_text: String(formData.get("diagnosis_text") ?? "").trim() || null,
  });

  if (!parsed.success) return { ok: false, error: firstZodIssue(parsed.error) };
  return { ok: true, data: parsed.data };
}

function revalidateTemplateViews() {
  revalidatePath("/plantillas-recetas");
}

export async function listPrescriptionTemplates(
  professionalId?: string | null
): Promise<{ data?: PrescriptionTemplateRow[]; error?: string }> {
  const [access, supabase] = await Promise.all([requireClinicalIssueAccess(), createClient()]);
  if (!access.ok) return { error: access.error };
  const result = await listPrescriptionTemplatesForClinic(supabase, access.data.clinicId, {
    professionalId: professionalId ?? undefined,
  });

  if (!result.ok) return { error: result.error };
  return { data: result.data };
}

export async function createPrescriptionTemplate(formData: FormData) {
  const [access, supabase] = await Promise.all([requireClinicalIssueAccess(), createClient()]);
  if (!access.ok) return { error: access.error };

  const parsed = parseTemplateForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const result = await insertPrescriptionTemplate(supabase, {
    clinic_id: access.data.clinicId,
    professional_id: parsed.data.professional_id ?? null,
    name: parsed.data.name,
    coverage_kind: parsed.data.coverage_kind ?? null,
    medications: parsed.data.medications,
    notes: parsed.data.notes ?? null,
    diagnosis_cie10: parsed.data.diagnosis_cie10 ?? null,
    diagnosis_text: parsed.data.diagnosis_text ?? null,
    created_by: access.data.userId,
  });

  if (!result.ok) {
    return {
      error:
        result.error.includes("unique") || result.error.includes("23505")
          ? "Ya existe una plantilla con ese nombre."
          : result.error,
    };
  }

  await recordAudit({
    clinicId: access.data.clinicId,
    module: "prescriptions",
    entityType: "prescription_template",
    entityId: result.data.id,
    action: "create",
    what: "Creó plantilla de receta",
    metadata: { name: parsed.data.name },
  });

  revalidateTemplateViews();
  return { data: result.data };
}

export async function updatePrescriptionTemplateAction(formData: FormData) {
  const [access, supabase] = await Promise.all([requireClinicalIssueAccess(), createClient()]);
  if (!access.ok) return { error: access.error };

  const idParsed = entityIdSchema.safeParse(String(formData.get("id") ?? ""));
  if (!idParsed.success) return { error: "Plantilla inválida." };

  const parsed = parseTemplateForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const result = await updatePrescriptionTemplate(supabase, idParsed.data, access.data.clinicId, {
    professional_id: parsed.data.professional_id ?? null,
    name: parsed.data.name,
    coverage_kind: parsed.data.coverage_kind ?? null,
    medications: parsed.data.medications,
    notes: parsed.data.notes ?? null,
    diagnosis_cie10: parsed.data.diagnosis_cie10 ?? null,
    diagnosis_text: parsed.data.diagnosis_text ?? null,
  });

  if (!result.ok) return { error: result.error };

  await recordAudit({
    clinicId: access.data.clinicId,
    module: "prescriptions",
    entityType: "prescription_template",
    entityId: idParsed.data,
    action: "update",
    what: "Actualizó plantilla de receta",
    metadata: { name: parsed.data.name },
  });

  revalidateTemplateViews();
  return { data: result.data };
}

export async function removePrescriptionTemplate(id: string) {
  const [access, supabase] = await Promise.all([requireClinicalIssueAccess(), createClient()]);
  if (!access.ok) return { error: access.error };

  const idParsed = entityIdSchema.safeParse(id);
  if (!idParsed.success) return { error: "Plantilla inválida." };
  const result = await deletePrescriptionTemplate(supabase, idParsed.data, access.data.clinicId);
  if (!result.ok) return { error: result.error };

  await recordAudit({
    clinicId: access.data.clinicId,
    module: "prescriptions",
    entityType: "prescription_template",
    entityId: idParsed.data,
    action: "delete",
    what: "Eliminó plantilla de receta",
  });

  revalidateTemplateViews();
  return { data: result.data };
}

/** Guarda plantilla desde el wizard (payload JSON, sin FormData). */
export async function savePrescriptionTemplateFromDraft(input: {
  name: string;
  professional_id?: string | null;
  coverage_kind?: string | null;
  medications: unknown;
  notes?: string | null;
  diagnosis_cie10?: string | null;
  diagnosis_text?: string | null;
}) {
  const access = await requireClinicalIssueAccess();
  if (!access.ok) return { error: access.error };

  const parsed = templateFieldsSchema.safeParse({
    name: input.name,
    professional_id: input.professional_id ?? null,
    coverage_kind: input.coverage_kind ?? null,
    medications: input.medications,
    notes: input.notes ?? null,
    diagnosis_cie10: input.diagnosis_cie10 ?? null,
    diagnosis_text: input.diagnosis_text ?? null,
  });

  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const formData = new FormData();
  formData.set("name", parsed.data.name);
  if (parsed.data.professional_id) formData.set("professional_id", parsed.data.professional_id);
  if (parsed.data.coverage_kind) formData.set("coverage_kind", parsed.data.coverage_kind);
  formData.set("medications_json", JSON.stringify(parsed.data.medications));
  if (parsed.data.notes) formData.set("notes", parsed.data.notes);
  if (parsed.data.diagnosis_cie10) formData.set("diagnosis_cie10", parsed.data.diagnosis_cie10);
  if (parsed.data.diagnosis_text) formData.set("diagnosis_text", parsed.data.diagnosis_text);

  return createPrescriptionTemplate(formData);
}
