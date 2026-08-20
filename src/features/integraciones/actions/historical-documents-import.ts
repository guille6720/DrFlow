"use server";

import { revalidatePath } from "next/cache";

import { resolveImportAccess } from "@/core/actions/action-response";
import { revalidateClinicalSurfaces } from "@/core/cache/revalidate-clinical";
import { recordAudit } from "@/core/security/audit-service";
import {
  buildPatientFilePath,
  validateAdminDocumentUpload,
} from "@/core/security/file-upload";
import { verifyPatientInClinic, verifyProfessionalInClinic } from "@/core/security/ownership-guard";
import { requireClinicalImportAccess } from "@/core/services/import-access.service";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

import { isIsoDateOnly } from "@/features/integraciones/lib/clinical-export-sections";

import {
  CLINICAL_DOCUMENT_CATEGORIES,
  CLINICAL_DOCUMENT_MAX_BYTES,
  type ClinicalDocumentCategory,
} from "@/lib/constants/clinical-documents";
import type { Database } from "@/types/supabase";

const BUCKET = "clinical-files";
const MAX_FILES = 10;
const VALID_CATEGORIES = new Set<ClinicalDocumentCategory>(
  CLINICAL_DOCUMENT_CATEGORIES.map((item) => item.value)
);

type PatientAttachmentInsert = Database["public"]["Tables"]["patient_attachments"]["Insert"];

export type HistoricalDocumentImportItem =
  | { fileName: string; ok: true; attachmentId: string }
  | { fileName: string; ok: false; error: string };

function parseCategory(raw: unknown): ClinicalDocumentCategory {
  const value = String(raw ?? "otro").trim();
  return VALID_CATEGORIES.has(value as ClinicalDocumentCategory)
    ? (value as ClinicalDocumentCategory)
    : "otro";
}

async function insertAttachment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  payload: PatientAttachmentInsert
) {
  const first = await supabase.from("patient_attachments").insert(payload).select("id").single();
  if (!first.error) return first;
  if (!/document_date|source|professional_id/i.test(first.error.message)) return first;
  const fallback: PatientAttachmentInsert = { ...payload };
  delete fallback.document_date;
  delete fallback.source;
  delete fallback.professional_id;
  return supabase.from("patient_attachments").insert(fallback).select("id").single();
}

export async function importHistoricalClinicalDocuments(formData: FormData): Promise<{
  error?: string;
  results?: HistoricalDocumentImportItem[];
}> {
  const access = await requireClinicalImportAccess();
  const auth = resolveImportAccess(access);
  if (!auth.ok) return { error: auth.error };

  const patientParsed = parseEntityId(formData.get("patient_id"), "Paciente");
  if (!patientParsed.ok) return { error: patientParsed.error };

  const documentDate = String(formData.get("document_date") ?? "").trim();
  if (!isIsoDateOnly(documentDate)) {
    return { error: "Indicá la fecha del documento." };
  }

  const source = String(formData.get("source") ?? "").trim().slice(0, 200);
  const category = parseCategory(formData.get("category"));
  const professionalRaw = String(formData.get("professional_id") ?? "").trim();
  const professionalParsed = professionalRaw
    ? parseEntityId(professionalRaw, "Profesional")
    : null;
  if (professionalParsed && !professionalParsed.ok) return { error: professionalParsed.error };

  const files = formData.getAll("file").filter((item): item is File => item instanceof File);
  if (files.length === 0) return { error: "Seleccioná PDF, JPG o PNG." };
  if (files.length > MAX_FILES) {
    return { error: `Máximo ${MAX_FILES} archivos por carga.` };
  }

  const supabase = await createClient();
  const owned = await verifyPatientInClinic(supabase, auth.clinicId, patientParsed.data);
  if (!owned.ok) return { error: owned.error };

  let professionalId: string | null = null;
  if (professionalParsed?.ok) {
    const professional = await verifyProfessionalInClinic(
      supabase,
      auth.clinicId,
      professionalParsed.data
    );
    if (!professional.ok) return { error: professional.error };
    professionalId = professionalParsed.data;
  }

  const results: HistoricalDocumentImportItem[] = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const validated = validateAdminDocumentUpload(file, buffer, CLINICAL_DOCUMENT_MAX_BYTES);
    if (!validated.ok) {
      results.push({ fileName: file.name, ok: false, error: validated.error });
      continue;
    }

    const fileName = validated.sanitizedName;
    const filePath = buildPatientFilePath(auth.clinicId, patientParsed.data, fileName, "clinical");
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, buffer, {
      contentType: validated.contentType,
      upsert: false,
    });
    if (uploadError) {
      results.push({
        fileName: file.name,
        ok: false,
        error: uploadError.message.toLowerCase().includes("bucket")
          ? "Falta crear el bucket clinical-files en Supabase."
          : uploadError.message,
      });
      continue;
    }

    const payload: PatientAttachmentInsert = {
      patient_id: patientParsed.data,
      clinic_id: auth.clinicId,
      file_name: fileName,
      file_path: filePath,
      file_type: validated.contentType,
      file_size: file.size,
      category,
      uploaded_by: auth.userId,
      document_date: documentDate,
      source: source || null,
      professional_id: professionalId,
    };

    const inserted = await insertAttachment(supabase, payload);
    if (inserted.error || !inserted.data) {
      await supabase.storage.from(BUCKET).remove([filePath]);
      results.push({
        fileName: file.name,
        ok: false,
        error: inserted.error?.message ?? "No se pudo registrar el adjunto.",
      });
      continue;
    }

    results.push({ fileName: file.name, ok: true, attachmentId: inserted.data.id });
  }

  const imported = results.filter((item) => item.ok).length;
  if (imported > 0) {
    await recordAudit({
      clinicId: auth.clinicId,
      module: "attachments",
      entityType: "data_import_session",
      entityId: patientParsed.data,
      patientId: patientParsed.data,
      action: "create",
      what: "Importó documentos históricos",
      metadata: {
        type: "historical_documents_import",
        category,
        documentDate,
        imported,
        fileNames: results.filter((item) => item.ok).map((item) => item.fileName),
      },
    });
    revalidateClinicalSurfaces();
    revalidatePath(`/pacientes/${patientParsed.data}`);
    revalidatePath("/datos");
  }

  return { results };
}
