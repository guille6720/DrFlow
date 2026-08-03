import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logAudit } from "@/lib/auth/session";
import { CLINICAL_DOCUMENT_MAX_BYTES } from "@/lib/constants/clinical-documents";
import {
  extractTextFromPdfBuffer,
  findOrCreatePatientFromExtract,
  enrichPatientFromLegacyPdfDemographics,
  insertLegacyPdfClinicalRecords,
  insertCompactClinicalPdfStructuralRecords,
} from "@/lib/utils/clinical-pdf-import";
import {
  isLegacyClinicalPdfExport,
  parseLegacyClinicalDemographics,
  parseLegacyClinicalEvolutionsWithFallback,
  parseCompactClinicalPdf,
} from "@/lib/utils/clinical-export-pdf-parse";
import {
  extractPatientFromFileName,
  extractPatientFromPdfText,
  mergePatientExtract,
} from "@/lib/utils/pdf-patient-extract";
import type { ImportClinicalPdfResult } from "@/lib/actions/patient-attachments";

const BUCKET = "clinical-files";

function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "documento.pdf";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}

function buildStoragePath(clinicId: string, patientId: string, fileName: string): string {
  return `${clinicId}/patients/${patientId}/${randomUUID()}-${fileName}`;
}

export async function processClinicalPdfImport(
  supabase: SupabaseClient,
  params: {
    clinicId: string;
    userId: string;
    buffer: Buffer;
    originalName: string;
    fileSize: number;
  }
): Promise<ImportClinicalPdfResult> {
  const { clinicId, userId, buffer, originalName, fileSize } = params;

  if (fileSize <= 0 || fileSize > CLINICAL_DOCUMENT_MAX_BYTES) {
    return {
      success: false,
      fileName: originalName,
      error: "Archivo PDF inválido o mayor a 10 MB",
    };
  }

  const fromFileName = extractPatientFromFileName(originalName);
  const pdfText = await extractTextFromPdfBuffer(buffer);
  const fromPdf = pdfText ? extractPatientFromPdfText(pdfText) : null;
  const extract = mergePatientExtract(fromFileName, fromPdf);

  if (!extract) {
    const unreadable = !pdfText?.trim();
    return {
      success: false,
      fileName: originalName,
      error: unreadable
        ? "No pudimos leer texto del PDF (¿escaneo sin OCR?). Exportá de nuevo el PDF o renombrá el archivo como APELLIDO_Nombre_12345678.pdf."
        : "No pudimos detectar el DNI del paciente. Renombrá el archivo como APELLIDO_Nombre_3736532.pdf o usá un PDF de historia clínica con el DNI en la primera página.",
    };
  }

  const { data: clinic } = await supabase
    .from("clinics")
    .select("default_insurance_provider")
    .eq("id", clinicId)
    .single();

  const patientResult = await findOrCreatePatientFromExtract(
    supabase,
    clinicId,
    extract,
    clinic?.default_insurance_provider ?? null,
    `Historia importada desde PDF: ${originalName}`
  );

  if ("error" in patientResult) {
    return { success: false, fileName: originalName, error: patientResult.error };
  }

  const fileName = sanitizeFileName(originalName);
  const filePath = buildStoragePath(clinicId, patientResult.patientId, fileName);

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, buffer, {
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
      clinic_id: clinicId,
      file_name: fileName,
      file_path: filePath,
      file_type: "application/pdf",
      file_size: fileSize,
      category: "historia_clinica",
      uploaded_by: userId,
    })
    .select("id")
    .single();

  if (insertError) {
    await supabase.storage.from(BUCKET).remove([filePath]);
    return { success: false, fileName: originalName, error: insertError.message };
  }

  await logAudit({
    clinicId,
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

  let legacyPdfImport:
    | {
        clinicalRecordsCreated: number;
        clinicalRecordsSkipped: number;
        partial?: boolean;
      }
    | undefined;

  const pdfReadable = Boolean(pdfText?.trim());
  const looksLikeLegacyClinicalPdf =
    (pdfReadable && isLegacyClinicalPdfExport(pdfText)) || /evoluciones/i.test(pdfText ?? "");

  if (looksLikeLegacyClinicalPdf) {
    if (!pdfReadable) {
      legacyPdfImport = { clinicalRecordsCreated: 0, clinicalRecordsSkipped: 0, partial: true };
    } else {
      const demographics = parseLegacyClinicalDemographics(pdfText);
      await enrichPatientFromLegacyPdfDemographics(
        supabase,
        patientResult.patientId,
        clinicId,
        demographics
      );

      const compactBundle = parseCompactClinicalPdf(pdfText);
      const evolutions = parseLegacyClinicalEvolutionsWithFallback(pdfText);
      if (evolutions.length > 0) {
        const insertResult = await insertLegacyPdfClinicalRecords(supabase, {
          clinicId,
          patientId: patientResult.patientId,
          userId,
          evolutions,
        });

        if (insertResult.error && insertResult.created === 0) {
          await supabase.storage.from(BUCKET).remove([filePath]);
          await supabase
            .from("patient_attachments")
            .delete()
            .eq("id", attachment.id)
            .eq("clinic_id", clinicId);
          return { success: false, fileName: originalName, error: insertResult.error };
        }

        legacyPdfImport = {
          clinicalRecordsCreated: insertResult.created,
          clinicalRecordsSkipped: insertResult.skipped,
        };

        if (compactBundle && compactBundle.treatments.length > 0) {
          const structural = await insertCompactClinicalPdfStructuralRecords(supabase, {
            clinicId,
            patientId: patientResult.patientId,
            userId,
            consultationDate: compactBundle.evolution.consultationDate,
            professionalName: compactBundle.evolution.professionalName,
            diagnosisName: compactBundle.diagnosisName,
            treatments: compactBundle.treatments,
          });
          legacyPdfImport.clinicalRecordsCreated += structural.created;
          legacyPdfImport.clinicalRecordsSkipped += structural.skipped;
        }

        await logAudit({
          clinicId,
          entityType: "clinical_record",
          entityId: patientResult.patientId,
          action: "create",
          metadata: {
            type: "legacy_pdf_import",
            attachmentId: attachment.id,
            clinicalRecordsCreated: insertResult.created,
            clinicalRecordsSkipped: insertResult.skipped,
          },
        });
      }
    }
  }

  return {
    success: true,
    fileName: originalName,
    patientId: patientResult.patientId,
    patientName: patientResult.patientName,
    documentNumber: extract.document_number,
    patientCreated: patientResult.created,
    attachmentId: attachment.id,
    legacyPdfImport,
  };
}
