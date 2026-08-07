"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getActiveClinic, getActiveClinicId } from "@/core/auth/session.server";
import { revalidateClinicClinicalTemplatesCache } from "@/core/cache/revalidate-clinic-cache";
import { hasPermission } from "@/core/permissions/roles";
import { recordAudit } from "@/core/security/audit-service";
import { createClient } from "@/core/supabase/server";
import { entityIdSchema, firstZodIssue, optionalEntityIdSchema } from "@/core/validations/params";

const templateFieldsSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres.").max(120),
  specialty_id: optionalEntityIdSchema,
  chief_complaint_template: z.string().max(5000).optional().nullable(),
  diagnosis_template: z.string().max(5000).optional().nullable(),
  evolution_template: z.string().max(10000).optional().nullable(),
  indications_template: z.string().max(5000).optional().nullable(),
});

async function requireTemplateEditor() {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!clinicId || !hasPermission(role, "editClinicalRecords", isSuperadmin)) {
    return { ok: false as const, error: "Sin permisos para gestionar plantillas clínicas." };
  }
  return { ok: true as const, clinicId, role, isSuperadmin };
}

function parseTemplateForm(formData: FormData) {
  const specialtyRaw = String(formData.get("specialty_id") ?? "").trim();
  return templateFieldsSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    specialty_id: specialtyRaw || null,
    chief_complaint_template: String(formData.get("chief_complaint_template") ?? "").trim() || null,
    diagnosis_template: String(formData.get("diagnosis_template") ?? "").trim() || null,
    evolution_template: String(formData.get("evolution_template") ?? "").trim() || null,
    indications_template: String(formData.get("indications_template") ?? "").trim() || null,
  });
}

function revalidateTemplateViews(clinicId: string) {
  revalidateClinicClinicalTemplatesCache(clinicId);
  revalidatePath("/plantillas");
  revalidatePath("/historias/nueva");
  revalidatePath("/pacientes", "layout");
}

export async function createClinicalTemplate(formData: FormData) {
  const access = await requireTemplateEditor();
  if (!access.ok) return { error: access.error };

  const parsed = parseTemplateForm(formData);
  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinical_templates")
    .insert({
      clinic_id: access.clinicId,
      name: parsed.data.name,
      specialty_id: parsed.data.specialty_id,
      chief_complaint_template: parsed.data.chief_complaint_template,
      diagnosis_template: parsed.data.diagnosis_template,
      evolution_template: parsed.data.evolution_template,
      indications_template: parsed.data.indications_template,
      is_active: true,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      error:
        error?.code === "23505"
          ? "Ya existe una plantilla con ese nombre."
          : error?.message ?? "No se pudo crear la plantilla.",
    };
  }

  await recordAudit({
    clinicId: access.clinicId,
    module: "clinical",
    entityType: "clinical_template",
    entityId: data.id,
    action: "create",
    metadata: { name: parsed.data.name },
  });

  revalidateTemplateViews(access.clinicId);
  return { data: { id: data.id } };
}

export async function updateClinicalTemplate(formData: FormData) {
  const access = await requireTemplateEditor();
  if (!access.ok) return { error: access.error };

  const idParsed = entityIdSchema.safeParse(String(formData.get("id") ?? ""));
  if (!idParsed.success) return { error: "Plantilla inválida." };

  const parsed = parseTemplateForm(formData);
  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinical_templates")
    .update({
      name: parsed.data.name,
      specialty_id: parsed.data.specialty_id,
      chief_complaint_template: parsed.data.chief_complaint_template,
      diagnosis_template: parsed.data.diagnosis_template,
      evolution_template: parsed.data.evolution_template,
      indications_template: parsed.data.indications_template,
    })
    .eq("id", idParsed.data)
    .eq("clinic_id", access.clinicId)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe una plantilla con ese nombre."
          : error.message,
    };
  }
  if (!data) return { error: "Plantilla no encontrada." };

  await recordAudit({
    clinicId: access.clinicId,
    module: "clinical",
    entityType: "clinical_template",
    entityId: data.id,
    action: "update",
    metadata: { name: parsed.data.name },
  });

  revalidateTemplateViews(access.clinicId);
  return { success: true };
}

export async function setClinicalTemplateActive(formData: FormData) {
  const access = await requireTemplateEditor();
  if (!access.ok) return { error: access.error };

  const idParsed = entityIdSchema.safeParse(String(formData.get("id") ?? ""));
  if (!idParsed.success) return { error: "Plantilla inválida." };

  const active = String(formData.get("is_active") ?? "") === "1";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinical_templates")
    .update({ is_active: active })
    .eq("id", idParsed.data)
    .eq("clinic_id", access.clinicId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Plantilla no encontrada." };

  revalidateTemplateViews(access.clinicId);
  return { success: true };
}
