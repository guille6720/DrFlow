"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getActiveClinic, getActiveClinicId, getProfile } from "@/core/auth/session.server";
import { revalidateClinicProfessionalsCache } from "@/core/cache/revalidate-clinic-cache";
import { hasPermission } from "@/core/permissions/roles";
import { recordAudit } from "@/core/security/audit-service";
import {
  buildProfessionalSignaturePath,
  validateSignatureImageUpload,
} from "@/core/security/file-upload";
import { createClient } from "@/core/supabase/server";
import { entityIdSchema, firstZodIssue } from "@/core/validations/params";

const BUCKET = "clinical-files";

const signatureTextSchema = z.object({
  professional_id: entityIdSchema,
  signature_text: z
    .string()
    .trim()
    .min(2, "La firma debe tener al menos 2 caracteres.")
    .max(240, "La firma es demasiado larga."),
});

async function requireSignatureEditor(professionalId: string) {
  const clinicId = await getActiveClinicId();
  const profile = await getProfile();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!clinicId || !profile?.id) {
    return { ok: false as const, error: "Sesión inválida." };
  }

  if (!hasPermission(role, "editClinicalRecords", isSuperadmin)) {
    return { ok: false as const, error: "Sin permisos para gestionar firmas." };
  }

  const supabase = await createClient();
  const { data: professional } = await supabase
    .from("professionals")
    .select("id, user_id, signature_image_path")
    .eq("id", professionalId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!professional) {
    return { ok: false as const, error: "Profesional no encontrado." };
  }

  const canManageAll = hasPermission(role, "manageStaff", isSuperadmin);
  if (!canManageAll && professional.user_id !== profile.id) {
    return { ok: false as const, error: "Solo podés editar tu propia firma." };
  }

  return {
    ok: true as const,
    clinicId,
    supabase,
    professional,
    userId: profile.id,
  };
}

function revalidateSignatureViews(clinicId: string) {
  revalidateClinicProfessionalsCache(clinicId);
  revalidatePath("/firmas");
}

export async function updateProfessionalSignatureText(formData: FormData) {
  const parsed = signatureTextSchema.safeParse({
    professional_id: String(formData.get("professional_id") ?? ""),
    signature_text: String(formData.get("signature_text") ?? ""),
  });
  if (!parsed.success) {
    return { error: firstZodIssue(parsed.error) };
  }

  const access = await requireSignatureEditor(parsed.data.professional_id);
  if (!access.ok) return { error: access.error };

  const { error } = await access.supabase
    .from("professionals")
    .update({ signature_text: parsed.data.signature_text })
    .eq("id", parsed.data.professional_id)
    .eq("clinic_id", access.clinicId);

  if (error) return { error: error.message };

  await recordAudit({
    clinicId: access.clinicId,
    entityType: "professional",
    entityId: parsed.data.professional_id,
    action: "update",
    metadata: { field: "signature_text" },
  });

  revalidateSignatureViews(access.clinicId);
  return { ok: true as const };
}

export async function uploadProfessionalSignature(formData: FormData) {
  const professionalParsed = entityIdSchema.safeParse(formData.get("professional_id"));
  if (!professionalParsed.success) {
    return { error: "Profesional inválido." };
  }

  const access = await requireSignatureEditor(professionalParsed.data);
  if (!access.ok) return { error: access.error };

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "Seleccioná una imagen de firma (PNG, JPEG o WebP)." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const validated = validateSignatureImageUpload(file, buffer);
  if (!validated.ok) return { error: validated.error };

  const filePath = buildProfessionalSignaturePath(
    access.clinicId,
    professionalParsed.data,
    validated.sanitizedName
  );

  const { error: uploadError } = await access.supabase.storage
    .from(BUCKET)
    .upload(filePath, buffer, {
      contentType: validated.contentType,
      upsert: false,
    });

  if (uploadError) {
    if (uploadError.message.toLowerCase().includes("bucket")) {
      return { error: "Falta configurar el bucket clinical-files en Supabase." };
    }
    return { error: uploadError.message };
  }

  const previousPath = access.professional.signature_image_path;

  const { error: updateError } = await access.supabase
    .from("professionals")
    .update({ signature_image_path: filePath })
    .eq("id", professionalParsed.data)
    .eq("clinic_id", access.clinicId);

  if (updateError) {
    await access.supabase.storage.from(BUCKET).remove([filePath]);
    return { error: updateError.message };
  }

  if (previousPath && previousPath !== filePath) {
    await access.supabase.storage.from(BUCKET).remove([previousPath]);
  }

  await recordAudit({
    clinicId: access.clinicId,
    entityType: "professional",
    entityId: professionalParsed.data,
    action: "update",
    metadata: { field: "signature_image_path" },
  });

  revalidateSignatureViews(access.clinicId);
  return { ok: true as const };
}

export async function removeProfessionalSignature(professionalId: string) {
  const parsed = entityIdSchema.safeParse(professionalId);
  if (!parsed.success) {
    return { error: "Profesional inválido." };
  }

  const access = await requireSignatureEditor(parsed.data);
  if (!access.ok) return { error: access.error };

  const previousPath = access.professional.signature_image_path;

  const { error } = await access.supabase
    .from("professionals")
    .update({ signature_image_path: null })
    .eq("id", parsed.data)
    .eq("clinic_id", access.clinicId);

  if (error) return { error: error.message };

  if (previousPath) {
    await access.supabase.storage.from(BUCKET).remove([previousPath]);
  }

  await recordAudit({
    clinicId: access.clinicId,
    entityType: "professional",
    entityId: parsed.data,
    action: "update",
    metadata: { field: "signature_image_removed" },
  });

  revalidateSignatureViews(access.clinicId);
  return { ok: true as const };
}
