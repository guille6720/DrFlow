"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/core/supabase/server";
import { getActiveClinic, getActiveClinicId, getSession, logAudit } from "@/core/auth/session";
import { hasPermission } from "@/core/permissions/roles";
import { enqueueClinicJob } from "@/core/jobs/enqueue";
import { processPendingClinicJobs } from "@/core/jobs/process";
import {
  validateCsvImportUpload,
  validatePdfUpload,
  validateSpreadsheetImportUpload,
} from "@/core/security/file-upload";
import {
  CLINICAL_DOCUMENT_MAX_BYTES,
  CLINICAL_PDF_IMPORT_MAX_FILES,
  CONSUMERS_IMPORT_MAX_BYTES,
  HCE_EXPORT_MAX_BYTES,
} from "@/lib/constants/clinical-documents";
import { HCE_IMPORT_BATCH_SIZE } from "@/lib/constants/clinical-documents";
import { uploadImportStagingFile } from "@/lib/server/import-staging";
import { parseEntityId } from "@/core/validations/params";

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

async function requirePatientImportAccess() {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!clinicId || !hasPermission(role, "managePatients", isSuperadmin)) {
    return { error: "Sin permisos" as const, clinicId: null, userId: null };
  }
  const user = await getSession();
  if (!user) return { error: "Sesión requerida" as const, clinicId: null, userId: null };
  return { error: null, clinicId, userId: user.id };
}

function scheduleWorker(clinicId: string) {
  after(async () => {
    try {
      await processPendingClinicJobs({ limit: 10, clinicId });
    } catch (err) {
      console.error("[import-jobs] worker failed", err);
    }
  });
}

export async function enqueueClinicalPdfImports(formData: FormData): Promise<{
  success?: true;
  jobIds?: string[];
  enqueued?: number;
  error?: string;
}> {
  const access = await requireClinicalImportAccess();
  if (access.error || !access.clinicId || !access.userId) {
    return { error: access.error ?? "Sin permisos" };
  }

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
      access.clinicId,
      file.name,
      buffer
    );

    const { id } = await enqueueClinicJob(supabase, {
      clinicId: access.clinicId,
      jobType: "import_clinical_pdf",
      payload: {
        storagePath,
        fileName: file.name,
        fileSize: file.size,
        userId: access.userId,
      },
      createdBy: access.userId,
    });

    jobIds.push(id);
  }

  await logAudit({
    clinicId: access.clinicId,
    entityType: "clinic_job",
    action: "create",
    metadata: { type: "import_clinical_pdf", count: jobIds.length, job_ids: jobIds },
  });

  scheduleWorker(access.clinicId);
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
  if (access.error || !access.clinicId || !access.userId) {
    return { error: access.error ?? "Sin permisos" };
  }

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
    access.clinicId,
    file.name,
    buffer
  );

  const { id } = await enqueueClinicJob(supabase, {
    clinicId: access.clinicId,
    jobType: "import_hce_batch",
    payload: {
      storagePath,
      fileName: file.name,
      offset: 0,
      batchSize: HCE_IMPORT_BATCH_SIZE,
      importKind: "hce",
      userId: access.userId,
    },
    createdBy: access.userId,
  });

  await logAudit({
    clinicId: access.clinicId,
    entityType: "clinic_job",
    action: "create",
    metadata: { type: "import_hce_batch", job_id: id, fileName: file.name },
  });

  scheduleWorker(access.clinicId);
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
  if (access.error || !access.clinicId || !access.userId) {
    return { error: access.error ?? "Sin permisos" };
  }

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
    access.clinicId,
    file.name,
    buffer
  );

  const { id } = await enqueueClinicJob(supabase, {
    clinicId: access.clinicId,
    jobType: "import_patients_batch",
    payload: {
      storagePath,
      fileName: file.name,
      offset: 0,
      batchSize: 80,
      importKind: "patients",
      userId: access.userId,
    },
    createdBy: access.userId,
  });

  await logAudit({
    clinicId: access.clinicId,
    entityType: "clinic_job",
    action: "create",
    metadata: { type: "import_patients_batch", job_id: id, fileName: file.name },
  });

  scheduleWorker(access.clinicId);
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
  if (access.error || !access.clinicId || !access.userId) {
    return { error: access.error ?? "Sin permisos" };
  }

  const idParsed = parseEntityId(patientId, "Paciente");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const { id } = await enqueueClinicJob(supabase, {
    clinicId: access.clinicId,
    jobType: "run_ai_task",
    payload: {
      task: "clinical_summary",
      patientId: idParsed.data,
    },
    createdBy: access.userId,
  });

  scheduleWorker(access.clinicId);
  revalidatePath("/configuracion");

  return { success: true, jobId: id };
}
