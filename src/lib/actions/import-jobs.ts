"use server";

import { revalidatePath } from "next/cache";

import { resolveImportAccess } from "@/core/actions/action-response";
import { logAudit } from "@/core/auth/session.actions";
import { assertClinicJobEnqueueAllowed } from "@/core/entitlements/clinic-job-guard.server";
import { scheduleAfterTask } from "@/core/errors/background.server";
import { enqueueClinicJob } from "@/core/jobs/enqueue";
import { processPendingClinicJobs } from "@/core/jobs/process";
import {
  validateCsvImportUpload,
  validatePdfUpload,
  validateSpreadsheetImportUpload,
} from "@/core/security/file-upload";
import { verifyPatientInClinic } from "@/core/security/ownership-guard";
import {
  requireClinicalImportAccess,
  requirePatientImportAccess,
} from "@/core/services/import-access.service";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

import {
  CLINICAL_DOCUMENT_MAX_BYTES,
  CLINICAL_PDF_IMPORT_MAX_FILES,
  CONSUMERS_IMPORT_MAX_BYTES,
  HCE_EXPORT_MAX_BYTES,
} from "@/lib/constants/clinical-documents";
import { HCE_IMPORT_BATCH_SIZE } from "@/lib/constants/clinical-documents";
import { uploadImportStagingFile } from "@/lib/server/import-staging";

function scheduleWorker(clinicId: string) {
  scheduleAfterTask("import-jobs.worker", () => processPendingClinicJobs({ limit: 10, clinicId }), {
    clinicId,
  });
}

export async function enqueueClinicalPdfImports(formData: FormData): Promise<{
  success?: true;
  jobIds?: string[];
  enqueued?: number;
  error?: string;
}> {
  const access = await requireClinicalImportAccess();
  const auth = resolveImportAccess(access);
  if (!auth.ok) return { error: auth.error };

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    const single = formData.get("file");
    if (single instanceof File) files.push(single);
  }

  if (files.length === 0) return { error: "Seleccioná al menos un PDF" };
  if (files.length > CLINICAL_PDF_IMPORT_MAX_FILES) {
    return { error: `Máximo ${CLINICAL_PDF_IMPORT_MAX_FILES} PDFs por tanda` };
  }

  const supabase = await createClient();
  const jobIds: string[] = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const validated = validatePdfUpload(file, buffer, CLINICAL_DOCUMENT_MAX_BYTES);
    if (!validated.ok) {
      return { error: `"${file.name}": ${validated.error}` };
    }

    const { storagePath } = await uploadImportStagingFile(
      supabase,
      auth.clinicId,
      file.name,
      buffer
    );

    const { id } = await enqueueClinicJob(supabase, {
      clinicId: auth.clinicId,
      jobType: "import_clinical_pdf",
      payload: {
        storagePath,
        fileName: file.name,
        fileSize: file.size,
        userId: auth.userId,
      },
      createdBy: auth.userId,
    });

    jobIds.push(id);
  }

  await logAudit({
    clinicId: auth.clinicId,
    entityType: "clinic_job",
    action: "create",
    metadata: { type: "import_clinical_pdf", count: jobIds.length, job_ids: jobIds },
  });

  scheduleWorker(auth.clinicId);
  revalidatePath("/configuracion");
  revalidatePath("/datos");

  return { success: true, jobIds, enqueued: jobIds.length };
}

export async function enqueueHceImportJob(formData: FormData): Promise<{
  success?: true;
  jobId?: string;
  error?: string;
}> {
  const access = await requireClinicalImportAccess();
  const auth = resolveImportAccess(access);
  if (!auth.ok) return { error: auth.error };

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "CSV HCE inválido o mayor a 15 MB" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const validated = validateCsvImportUpload(file, buffer, HCE_EXPORT_MAX_BYTES);
  if (!validated.ok) return { error: validated.error };

  const supabase = await createClient();
  const { storagePath } = await uploadImportStagingFile(
    supabase,
    auth.clinicId,
    file.name,
    buffer
  );

  const { id } = await enqueueClinicJob(supabase, {
    clinicId: auth.clinicId,
    jobType: "import_hce_batch",
    payload: {
      storagePath,
      fileName: file.name,
      offset: 0,
      batchSize: HCE_IMPORT_BATCH_SIZE,
      importKind: "hce",
      userId: auth.userId,
    },
    createdBy: auth.userId,
  });

  await logAudit({
    clinicId: auth.clinicId,
    entityType: "clinic_job",
    action: "create",
    metadata: { type: "import_hce_batch", job_id: id, fileName: file.name },
  });

  scheduleWorker(auth.clinicId);
  revalidatePath("/configuracion");
  revalidatePath("/datos");

  return { success: true, jobId: id };
}

export async function enqueueConsumersImportJob(formData: FormData): Promise<{
  success?: true;
  jobId?: string;
  error?: string;
}> {
  const access = await requirePatientImportAccess();
  const auth = resolveImportAccess(access);
  if (!auth.ok) return { error: auth.error };

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return { error: "Archivo inválido (máx. 15 MB)" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const validated = validateSpreadsheetImportUpload(file, buffer, CONSUMERS_IMPORT_MAX_BYTES);
  if (!validated.ok) return { error: validated.error };

  const supabase = await createClient();
  const { storagePath } = await uploadImportStagingFile(
    supabase,
    auth.clinicId,
    file.name,
    buffer
  );

  const { id } = await enqueueClinicJob(supabase, {
    clinicId: auth.clinicId,
    jobType: "import_patients_batch",
    payload: {
      storagePath,
      fileName: file.name,
      offset: 0,
      batchSize: 80,
      importKind: "patients",
      userId: auth.userId,
    },
    createdBy: auth.userId,
  });

  await logAudit({
    clinicId: auth.clinicId,
    entityType: "clinic_job",
    action: "create",
    metadata: { type: "import_patients_batch", job_id: id, fileName: file.name },
  });

  scheduleWorker(auth.clinicId);
  revalidatePath("/configuracion");
  revalidatePath("/datos");

  return { success: true, jobId: id };
}

export async function enqueuePatientAiSummaryJob(patientId: string): Promise<{
  success?: true;
  jobId?: string;
  error?: string;
}> {
  const access = await requireClinicalImportAccess();
  const auth = resolveImportAccess(access);
  if (!auth.ok) return { error: auth.error };

  const idParsed = parseEntityId(patientId, "Paciente");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const ownership = await verifyPatientInClinic(supabase, auth.clinicId, idParsed.data);
  if (!ownership.ok) return { error: ownership.error };

  const payload = {
    task: "clinical_summary",
    patientId: idParsed.data,
  };
  const guard = await assertClinicJobEnqueueAllowed({
    clinicId: auth.clinicId,
    jobType: "run_ai_task",
    payload,
    supabase,
  });
  if (!guard.ok) return { error: guard.error };

  const { id } = await enqueueClinicJob(supabase, {
    clinicId: auth.clinicId,
    jobType: "run_ai_task",
    payload,
    createdBy: auth.userId,
  });

  scheduleWorker(auth.clinicId);
  revalidatePath("/configuracion");

  return { success: true, jobId: id };
}
