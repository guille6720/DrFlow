"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, logAudit } from "@/lib/auth/session";
import { requireClinicPermission } from "@/lib/actions/clinic-guard";

const MAX_BYTES = 10 * 1024 * 1024;

export async function uploadPatientAdminDocument(formData: FormData) {
  const access = await requireClinicPermission("manageAdminDocuments");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;
  const user = await getSession();

  const patientId = formData.get("patient_id");
  const category = formData.get("category");
  const title = formData.get("title");
  const file = formData.get("file");

  if (typeof patientId !== "string" || typeof category !== "string") {
    return { error: "Datos incompletos" };
  }
  if (!(file instanceof File)) return { error: "Archivo requerido" };
  if (file.size > MAX_BYTES) return { error: "Máximo 10 MB" };

  const supabase = await createClient();
  const { data: patient } = await supabase
    .from("patients")
    .select("id")
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .single();

  if (!patient) return { error: "Paciente no encontrado en este consultorio" };

  const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
  const path = `${clinicId}/${patientId}/admin/${Date.now()}-${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("clinical-files")
    .upload(path, buffer, { contentType: file.type || "application/pdf", upsert: false });

  if (uploadError) return { error: uploadError.message };

  const { data, error } = await supabase
    .from("patient_admin_documents")
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      category,
      title: typeof title === "string" && title.trim() ? title.trim() : safeName,
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
  revalidatePath(`/pacientes/${patientId}`);
  return { data };
}

export async function deletePatientAdminDocument(id: string) {
  const access = await requireClinicPermission("manageAdminDocuments");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("patient_admin_documents")
    .select("file_path, patient_id")
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .single();

  if (!doc) return { error: "Documento no encontrado" };

  await supabase.storage.from("clinical-files").remove([doc.file_path]);
  const { error } = await supabase
    .from("patient_admin_documents")
    .delete()
    .eq("id", id)
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  await logAudit({
    clinicId,
    entityType: "patient_admin_document",
    entityId: id,
    action: "delete",
  });

  revalidatePath("/secretaria/documentos");
  return { success: true };
}

export async function getAdminDocumentUrl(id: string) {
  const access = await requireClinicPermission("manageAdminDocuments");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("patient_admin_documents")
    .select("file_path")
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .single();

  if (!doc) return { error: "No encontrado" };

  const { data: signed } = await supabase.storage
    .from("clinical-files")
    .createSignedUrl(doc.file_path, 3600);

  return { url: signed?.signedUrl ?? null };
}
