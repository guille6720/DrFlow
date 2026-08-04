"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/core/supabase/server";
import { getSession, logAudit } from "@/core/auth/session";
import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { adminDocumentUploadSchema } from "@/core/validations/admin-documents";
import { parseEntityId, firstZodIssue } from "@/core/validations/params";

const MAX_BYTES = 10 * 1024 * 1024;

export async function uploadPatientAdminDocument(formData: FormData) {
  const access = await requireClinicPermission("manageAdminDocuments");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;
  const user = await getSession();

  const parsed = adminDocumentUploadSchema.safeParse({
    patient_id: formData.get("patient_id"),
    category: formData.get("category"),
    title: formData.get("title") ?? undefined,
  });
  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Archivo requerido" };
  if (file.size > MAX_BYTES) return { error: "Máximo 10 MB" };

  const supabase = await createClient();
  const { data: patient } = await supabase
    .from("patients")
    .select("id")
    .eq("id", parsed.data.patient_id)
    .eq("clinic_id", clinicId)
    .single();

  if (!patient) return { error: "Paciente no encontrado en este consultorio" };

  const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
  const path = `${clinicId}/${parsed.data.patient_id}/admin/${Date.now()}-${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("clinical-files")
    .upload(path, buffer, { contentType: file.type || "application/pdf", upsert: false });

  if (uploadError) return { error: uploadError.message };

  const { data, error } = await supabase
    .from("patient_admin_documents")
    .insert({
      clinic_id: clinicId,
      patient_id: parsed.data.patient_id,
      category: parsed.data.category,
      title: parsed.data.title?.trim() ? parsed.data.title.trim() : safeName,
      file_name: safeName,
      file_path: path,
      file_size: file.size,
      uploaded_by: user?.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  await logAudit({
    clinicId,
    entityType: "patient_admin_document",
    entityId: data.id,
    action: "create",
  });

  revalidatePath(`/secretaria/documentos`);
  revalidatePath(`/pacientes/${parsed.data.patient_id}`);
  return { data };
}

export async function deletePatientAdminDocument(id: string) {
  const access = await requireClinicPermission("manageAdminDocuments");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;

  const idParsed = parseEntityId(id, "Documento");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("patient_admin_documents")
    .select("file_path, patient_id")
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .single();

  if (!doc) return { error: "Documento no encontrado" };

  await supabase.storage.from("clinical-files").remove([doc.file_path]);
  const { error } = await supabase
    .from("patient_admin_documents")
    .delete()
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  await logAudit({
    clinicId,
    entityType: "patient_admin_document",
    entityId: idParsed.data,
    action: "delete",
  });

  revalidatePath("/secretaria/documentos");
  return { success: true };
}

export async function getAdminDocumentUrl(id: string) {
  const access = await requireClinicPermission("manageAdminDocuments");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;

  const idParsed = parseEntityId(id, "Documento");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("patient_admin_documents")
    .select("file_path")
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .single();

  if (!doc) return { error: "No encontrado" };

  const { data: signed } = await supabase.storage
    .from("clinical-files")
    .createSignedUrl(doc.file_path, 3600);

  return { url: signed?.signedUrl ?? null };
}
