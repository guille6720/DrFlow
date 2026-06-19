"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getActiveClinic, getActiveClinicId, getSession, logAudit } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/roles";
import {
  CLINICAL_DOCUMENT_MAX_BYTES,
  type ClinicalDocumentCategory,
} from "@/lib/constants/clinical-documents";
import {
  extractTextFromPdfBuffer,
  findOrCreatePatientFromExtract,
} from "@/lib/utils/clinical-pdf-import";
import {
  extractPatientFromFileName,
  extractPatientFromPdfText,
  mergePatientExtract,
} from "@/lib/utils/pdf-patient-extract";

const BUCKET = "clinical-files";

const VALID_CATEGORIES = new Set<ClinicalDocumentCategory>([
  "historia_clinica",
  "estudio",
  "otro",
]);

function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "documento.pdf";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}

function buildStoragePath(clinicId: string, patientId: string, fileName: string): string {
  return `${clinicId}/patients/${patientId}/${randomUUID()}-${fileName}`;
}

async function requireClinicalAccess(mode: "view" | "edit") {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  const permission = mode === "edit" ? "editClinicalRecords" : "viewClinicalRecords";
  if (!clinicId || !hasPermission(role, permission, isSuperadmin)) {
    return { error: "Sin permisos" as const, clinicId: null, userId: null };
  }
  const user = await getSession();
  if (!user) return { error: "Sesión requerida" as const, clinicId: null, userId: null };
  return { error: null, clinicId, userId: user.id };
}

async function requireClinicalImportAccess() {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  const canImport =
    hasPermission(role, "editClinicalRecords", isSuperadmin) ||
    hasPermission(role, "managePatients", isSuperadmin);
  if (!clinicId || !canImport) {
    return { error: "Sin permisos" as const, clinicId: null, userId: null };
  }
  const user = await getSession();
  if (!user) return { error: "Sesión requerida" as const, clinicId: null, userId: null };
  return { error: null, clinicId, userId: user.id };
}

function validatePdfFile(file: unknown): file is File {
  return (
    file instanceof File &&
    file.size > 0 &&
    (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) &&
    file.size <= CLINICAL_DOCUMENT_MAX_BYTES
  );
}

export async function uploadPatientClinicalDocument(formData: FormData) {
  const access = await requireClinicalAccess("edit");
  if (access.error || !access.clinicId || !access.userId) {
    return { error: access.error ?? "Sin permisos" };
  }

  const patientId = String(formData.get("patient_id") ?? "").trim();
  const categoryRaw = String(formData.get("category") ?? "otro").trim();
  const category = VALID_CATEGORIES.has(categoryRaw as ClinicalDocumentCategory)
    ? (categoryRaw as ClinicalDocumentCategory)
    : "otro";
  const file = formData.get("file");

  if (!patientId) return { error: "Paciente requerido" };
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Seleccioná un archivo PDF" };
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { error: "Solo se permiten archivos PDF" };
  }
  if (file.size > CLINICAL_DOCUMENT_MAX_BYTES) {
    return { error: "El PDF no puede superar 10 MB" };
  }

  const supabase = await createClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("id")
    .eq("id", patientId)
    .eq("clinic_id", access.clinicId)
    .single();

  if (!patient) return { error: "Paciente no encontrado" };

  const fileName = sanitizeFileName(file.name);
  const filePath = buildStoragePath(access.clinicId, patientId, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    if (uploadError.message.toLowerCase().includes("bucket")) {
      return {
        error:
          "Falta crear el bucket clinical-files en Supabase (migración 028).",
      };
    }
    return { error: uploadError.message };
  }

  const { data: attachment, error: insertError } = await supabase
    .from("patient_attachments")
    .insert({
      patient_id: patientId,
      clinic_id: access.clinicId,
      file_name: fileName,
      file_path: filePath,
      file_type: "application/pdf",
      file_size: file.size,
      category,
      uploaded_by: access.userId,
    })
    .select("id")
    .single();

  if (insertError) {
    await supabase.storage.from(BUCKET).remove([filePath]);
    return { error: insertError.message };
  }

  await logAudit({
    clinicId: access.clinicId,
    entityType: "patient",
    entityId: patientId,
    action: "create",
    metadata: {
      attachmentId: attachment.id,
      fileName,
      category,
      type: "clinical_document",
    },
  });

  revalidatePath("/historias");
  revalidatePath(`/pacientes/${patientId}`);
  return { success: true, id: attachment.id };
}

export async function deletePatientClinicalDocument(id: string) {
  const access = await requireClinicalAccess("edit");
  if (access.error || !access.clinicId) {
    return { error: access.error ?? "Sin permisos" };
  }

  const supabase = await createClient();
  const { data: attachment } = await supabase
    .from("patient_attachments")
    .select("id, patient_id, file_path, file_name, category")
    .eq("id", id)
    .eq("clinic_id", access.clinicId)
    .single();

  if (!attachment) return { error: "Documento no encontrado" };

  await supabase.storage.from(BUCKET).remove([attachment.file_path]);

  const { error } = await supabase.from("patient_attachments").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    clinicId: access.clinicId,
    entityType: "patient",
    entityId: attachment.patient_id,
    action: "delete",
    metadata: {
      attachmentId: id,
      fileName: attachment.file_name,
      category: attachment.category,
      type: "clinical_document",
    },
  });

  revalidatePath("/historias");
  revalidatePath(`/pacientes/${attachment.patient_id}`);
  return { success: true };
}

export async function getPatientClinicalDocumentUrl(id: string) {
  const access = await requireClinicalAccess("view");
  if (access.error || !access.clinicId) {
    return { error: access.error ?? "Sin permisos" };
  }

  const supabase = await createClient();
  const { data: attachment } = await supabase
    .from("patient_attachments")
    .select("file_path, file_name")
    .eq("id", id)
    .eq("clinic_id", access.clinicId)
    .single();

  if (!attachment) return { error: "Documento no encontrado" };

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(attachment.file_path, 3600);

  if (error || !data?.signedUrl) {
    return { error: error?.message ?? "No se pudo abrir el documento" };
  }

  return { url: data.signedUrl, fileName: attachment.file_name };
}

export type ImportClinicalPdfResult =
  | {
      success: true;
      fileName: string;
      patientId: string;
      patientName: string;
      documentNumber: string;
      patientCreated: boolean;
      attachmentId: string;
    }
  | {
      success: false;
      fileName: string;
      error: string;
    };

/** Importa un PDF externo: detecta o crea paciente y adjunta la historia. */
export async function importClinicalPdfDocument(
  formData: FormData
): Promise<ImportClinicalPdfResult> {
  const access = await requireClinicalImportAccess();
  if (access.error || !access.clinicId || !access.userId) {
    return { success: false, fileName: "", error: access.error ?? "Sin permisos" };
  }

  const file = formData.get("file");
  const originalName = file instanceof File ? file.name : "documento.pdf";

  if (!validatePdfFile(file)) {
    return {
      success: false,
      fileName: originalName,
      error: "Archivo PDF inválido o mayor a 10 MB",
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fromFileName = extractPatientFromFileName(file.name);
  const pdfText = await extractTextFromPdfBuffer(buffer);
  const fromPdf = pdfText ? extractPatientFromPdfText(pdfText) : null;
  const extract = mergePatientExtract(fromFileName, fromPdf);

  if (!extract) {
    return {
      success: false,
      fileName: originalName,
      error:
        "No pudimos detectar el DNI del paciente. Renombrá el archivo como APELLIDO_Nombre_12345678.pdf o usá un PDF con DNI visible.",
    };
  }

  const supabase = await createClient();
  const { data: clinic } = await supabase
    .from("clinics")
    .select("default_insurance_provider")
    .eq("id", access.clinicId)
    .single();

  const patientResult = await findOrCreatePatientFromExtract(
    supabase,
    access.clinicId,
    extract,
    clinic?.default_insurance_provider ?? null,
    `Historia importada desde PDF: ${originalName}`
  );

  if ("error" in patientResult) {
    return { success: false, fileName: originalName, error: patientResult.error };
  }

  const fileName = sanitizeFileName(file.name);
  const filePath = buildStoragePath(access.clinicId, patientResult.patientId, fileName);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    if (uploadError.message.toLowerCase().includes("bucket")) {
      return {
        success: false,
        fileName: originalName,
        error: "Falta crear el bucket clinical-files en Supabase (migración 028).",
      };
    }
    return { success: false, fileName: originalName, error: uploadError.message };
  }

  const { data: attachment, error: insertError } = await supabase
    .from("patient_attachments")
    .insert({
      patient_id: patientResult.patientId,
      clinic_id: access.clinicId,
      file_name: fileName,
      file_path: filePath,
      file_type: "application/pdf",
      file_size: file.size,
      category: "historia_clinica",
      uploaded_by: access.userId,
    })
    .select("id")
    .single();

  if (insertError) {
    await supabase.storage.from(BUCKET).remove([filePath]);
    return { success: false, fileName: originalName, error: insertError.message };
  }

  await logAudit({
    clinicId: access.clinicId,
    entityType: "patient",
    entityId: patientResult.patientId,
    action: patientResult.created ? "create" : "update",
    metadata: {
      attachmentId: attachment.id,
      fileName,
      type: "clinical_pdf_import",
      documentNumber: extract.document_number,
      patientCreated: patientResult.created,
    },
  });

  revalidatePath("/historias");
  revalidatePath("/pacientes");
  revalidatePath(`/pacientes/${patientResult.patientId}`);

  return {
    success: true,
    fileName: originalName,
    patientId: patientResult.patientId,
    patientName: patientResult.patientName,
    documentNumber: extract.document_number,
    patientCreated: patientResult.created,
    attachmentId: attachment.id,
  };
}
