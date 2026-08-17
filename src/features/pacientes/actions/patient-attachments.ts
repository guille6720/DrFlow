"use server";

import { revalidatePath } from "next/cache";

import {
  resolveClinicalRecordAccess,
  resolveImportAccess,
} from "@/core/actions/action-response";
import { logAudit } from "@/core/auth/session.actions";
import { revalidateClinicalSurfaces } from "@/core/cache/revalidate-clinical";
import {
  buildPatientFilePath,
  validateAdminDocumentUpload,
  validatePdfUpload,
} from "@/core/security/file-upload";
import { requireClinicalRecordAccess } from "@/core/services/clinical-access.service";
import { requireClinicalImportAccess } from "@/core/services/import-access.service";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

import {
  CLINICAL_DOCUMENT_MAX_BYTES,
  type ClinicalDocumentCategory,
} from "@/lib/constants/clinical-documents";
import { processClinicalPdfImport } from "@/lib/server/process-clinical-pdf-import";

const BUCKET = "clinical-files";

function revalidatePatientDocumentSurfaces(
  patientId: string,
  clinicalRecordId?: string | null
) {
  revalidatePath(`/pacientes/${patientId}`, "page");
  if (clinicalRecordId) {
    revalidatePath(`/historias/${clinicalRecordId}`, "page");
  }
}

const VALID_CATEGORIES = new Set<ClinicalDocumentCategory>([
  "historia_clinica",
  "estudio",
  "otro",
]);

export async function uploadPatientClinicalDocument(formData: FormData) {
  const access = await requireClinicalRecordAccess("edit");
  const auth = resolveClinicalRecordAccess(access);
  if (!auth.ok) return { error: auth.error };

  const patientParsed = parseEntityId(formData.get("patient_id"), "Paciente");
  if (!patientParsed.ok) return { error: patientParsed.error };

  const categoryRaw = String(formData.get("category") ?? "otro").trim();
  const category = VALID_CATEGORIES.has(categoryRaw as ClinicalDocumentCategory)
    ? (categoryRaw as ClinicalDocumentCategory)
    : "otro";
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "Seleccioná un archivo PDF, JPG o PNG" };
  }

  const clinicalRecordRaw = String(formData.get("clinical_record_id") ?? "").trim();
  const clinicalRecordParsed = clinicalRecordRaw
    ? parseEntityId(clinicalRecordRaw, "Consulta")
    : null;
  if (clinicalRecordParsed && !clinicalRecordParsed.ok) {
    return { error: clinicalRecordParsed.error };
  }

  const [supabase, arrayBuffer] = await Promise.all([createClient(), file.arrayBuffer()]);
  const buffer = Buffer.from(arrayBuffer);
  const validated = validateAdminDocumentUpload(file, buffer, CLINICAL_DOCUMENT_MAX_BYTES);
  if (!validated.ok) return { error: validated.error };

  const patientPromise = supabase
    .from("patients")
    .select("id")
    .eq("id", patientParsed.data)
    .eq("clinic_id", auth.clinicId)
    .maybeSingle();

  const recordPromise = clinicalRecordParsed?.ok
    ? supabase
        .from("clinical_records")
        .select("id")
        .eq("id", clinicalRecordParsed.data)
        .eq("clinic_id", auth.clinicId)
        .eq("patient_id", patientParsed.data)
        .maybeSingle()
    : Promise.resolve({ data: null as { id: string } | null });

  const [{ data: patient }, { data: record }] = await Promise.all([patientPromise, recordPromise]);

  if (!patient) return { error: "Paciente no encontrado" };

  let clinicalRecordId: string | null = null;
  if (clinicalRecordParsed?.ok) {
    if (!record) return { error: "Consulta no encontrada para este paciente" };
    clinicalRecordId = record.id;
  }

  const fileName = validated.sanitizedName;
  const filePath = buildPatientFilePath(auth.clinicId, patientParsed.data, fileName, "clinical", {
    clinicalRecordId,
  });

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, buffer, {
      contentType: validated.contentType,
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

  const insertPayload: Record<string, unknown> = {
    patient_id: patientParsed.data,
    clinic_id: auth.clinicId,
    file_name: fileName,
    file_path: filePath,
    file_type: validated.contentType,
    file_size: file.size,
    category,
    uploaded_by: auth.userId,
  };
  if (clinicalRecordId) insertPayload.clinical_record_id = clinicalRecordId;

  const { data: attachment, error: insertError } = await supabase
    .from("patient_attachments")
    .insert(insertPayload)
    .select("id")
    .single();

  if (insertError) {
    // Retry without clinical_record_id if column missing (pre-migration).
    if (clinicalRecordId && /clinical_record_id/i.test(insertError.message)) {
      delete insertPayload.clinical_record_id;
      const retry = await supabase
        .from("patient_attachments")
        .insert(insertPayload)
        .select("id")
        .single();
      if (retry.error) {
        await supabase.storage.from(BUCKET).remove([filePath]);
        return { error: retry.error.message };
      }
      await logAudit({
        clinicId: auth.clinicId,
        entityType: "patient",
        entityId: patientParsed.data,
        action: "create",
        metadata: {
          attachmentId: retry.data.id,
          fileName,
          category,
          type: "clinical_document",
          clinicalRecordId,
        },
      });
      revalidatePatientDocumentSurfaces(patientParsed.data, clinicalRecordId);
      return { success: true, id: retry.data.id };
    }
    await supabase.storage.from(BUCKET).remove([filePath]);
    return { error: insertError.message };
  }

  await logAudit({
    clinicId: auth.clinicId,
    entityType: "patient",
    entityId: patientParsed.data,
    action: "create",
    metadata: {
      attachmentId: attachment.id,
      fileName,
      category,
      type: "clinical_document",
      clinicalRecordId,
    },
  });

  revalidatePatientDocumentSurfaces(patientParsed.data, clinicalRecordId);
  return { success: true, id: attachment.id };
}

export async function deletePatientClinicalDocument(id: string) {
  const [access, supabase] = await Promise.all([
    requireClinicalRecordAccess("edit"),
    createClient(),
  ]);
  const auth = resolveClinicalRecordAccess(access, { requireUserId: false });
  if (!auth.ok) return { error: auth.error };

  const idParsed = parseEntityId(id, "Documento");
  if (!idParsed.ok) return { error: idParsed.error };
  const { data: attachment } = await supabase
    .from("patient_attachments")
    .select("id, patient_id, file_path, file_name, category, clinical_record_id")
    .eq("id", idParsed.data)
    .eq("clinic_id", auth.clinicId)
    .single();

  if (!attachment) return { error: "Documento no encontrado" };

  await supabase.storage.from(BUCKET).remove([attachment.file_path]);

  const { error } = await supabase
    .from("patient_attachments")
    .delete()
    .eq("id", idParsed.data)
    .eq("clinic_id", auth.clinicId);
  if (error) return { error: error.message };

  await logAudit({
    clinicId: auth.clinicId,
    entityType: "patient",
    entityId: attachment.patient_id,
    action: "delete",
    metadata: {
      attachmentId: idParsed.data,
      fileName: attachment.file_name,
      category: attachment.category,
      type: "clinical_document",
    },
  });

  revalidatePatientDocumentSurfaces(
    attachment.patient_id,
    (attachment as { clinical_record_id?: string | null }).clinical_record_id
  );
  return { success: true };
}

export async function getPatientClinicalDocumentUrl(id: string) {
  const [access, supabase] = await Promise.all([
    requireClinicalRecordAccess("view"),
    createClient(),
  ]);
  const auth = resolveClinicalRecordAccess(access, { requireUserId: false });
  if (!auth.ok) return { error: auth.error };

  const idParsed = parseEntityId(id, "Documento");
  if (!idParsed.ok) return { error: idParsed.error };
  const { data: attachment } = await supabase
    .from("patient_attachments")
    .select("file_path, file_name")
    .eq("id", idParsed.data)
    .eq("clinic_id", auth.clinicId)
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
      legacyPdfImport?: {
        clinicalRecordsCreated: number;
        clinicalRecordsSkipped: number;
        partial?: boolean;
      };
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
  const auth = resolveImportAccess(access);
  if (!auth.ok) return { success: false, fileName: "", error: auth.error };

  const file = formData.get("file");
  const originalName = file instanceof File ? file.name : "documento.pdf";

  if (!(file instanceof File)) {
    return { success: false, fileName: originalName, error: "Archivo PDF inválido o mayor a 10 MB" };
  }

  const [buffer, supabase] = await Promise.all([
    file.arrayBuffer().then((bytes) => Buffer.from(bytes)),
    createClient(),
  ]);
  const validated = validatePdfUpload(file, buffer, CLINICAL_DOCUMENT_MAX_BYTES);
  if (!validated.ok) {
    return { success: false, fileName: originalName, error: validated.error };
  }
  const result = await processClinicalPdfImport(supabase, {
    clinicId: auth.clinicId,
    userId: auth.userId,
    buffer,
    originalName,
    fileSize: file.size,
  });

  if (result.success) {
    revalidateClinicalSurfaces();
    revalidatePath(`/pacientes/${result.patientId}`);
  }

  return result;
}
