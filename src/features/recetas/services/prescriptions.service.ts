import type { z } from "zod";

import type { DbClient } from "@/core/repositories/types";
import type { ServiceResult } from "@/core/services/types";
import { fromRepo, serviceErr, serviceOk } from "@/core/services/types";
import { firstZodIssue } from "@/core/validations/params";
import { prescriptionDraftSchema, sanitizeText } from "@/core/validations/schemas";

import {
  buildPrescriptionContext,
  enrichDraftFromPatient,
  resolveAuthoritativeCoverageForIssue,
  validatePrescriptionDraft,
} from "@/features/recetas/engine/prescription-engine";
import type { CoverageRuleConfig, PrescriptionDraftInput } from "@/features/recetas/engine/types";
import { loadActiveCoverageRulesForClinic } from "@/features/recetas/repositories/coverage-rules.repository";
import {
  findPrescriptionByIdempotencyKey,
  getPrescriptionDraftForIssue,
  insertPrescriptionDraft,
  issuePrescriptionDraft,
  markPrescriptionDispensed as markPrescriptionDispensedRow,
  type PrescriptionDraftInsertRow,
  updatePrescriptionDraft,
  voidPrescriptionDraft,
} from "@/features/recetas/repositories/prescription-drafts.repository";
import { insertPrescriptionEvent } from "@/features/recetas/repositories/prescription-events.repository";
import {
  isPrescriptionUniqueViolation,
  PRESCRIPTION_IDEMPOTENCY_CONFLICT,
} from "@/features/recetas/utils/prescription-idempotency";

import type { ElectronicPrescription } from "@/types/prescription";

type PrescriptionDraftInputParsed = z.infer<typeof prescriptionDraftSchema>;

export function parseMedicationsJson(raw: unknown): unknown {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

export function buildPrescriptionPayload(formData: FormData) {
  const medicationsRaw = formData.get("medications_json");
  const medications = parseMedicationsJson(medicationsRaw);

  const idempotencyRaw = formData.get("idempotency_key");
  const idempotencyKey =
    idempotencyRaw == null || String(idempotencyRaw).trim() === ""
      ? null
      : String(idempotencyRaw).trim();

  return {
    patient_id: String(formData.get("patient_id") ?? ""),
    clinical_record_id: String(formData.get("clinical_record_id") ?? "") || null,
    professional_id: String(formData.get("professional_id") ?? ""),
    prescription_type: String(formData.get("prescription_type") ?? "ambulatoria"),
    diagnosis_cie10: String(formData.get("diagnosis_cie10") ?? ""),
    diagnosis_text: String(formData.get("diagnosis_text") ?? ""),
    patient_insurance: String(formData.get("patient_insurance") ?? "") || undefined,
    insurance_number: String(formData.get("insurance_number") ?? "") || undefined,
    insurance_plan: String(formData.get("insurance_plan") ?? "") || undefined,
    medications,
    notes: String(formData.get("notes") ?? "") || undefined,
    validity_days: Number(formData.get("validity_days") ?? 30),
    disclaimer_accepted:
      formData.get("disclaimer_accepted") === "on" ||
      formData.get("disclaimer_accepted") === "true",
    idempotency_key: idempotencyKey,
  };
}

export function parseValidatedPrescriptionDraft(
  input: unknown
): ServiceResult<PrescriptionDraftInputParsed> {
  const parsed = prescriptionDraftSchema.safeParse(input);
  if (!parsed.success) return serviceErr(firstZodIssue(parsed.error));
  return serviceOk(parsed.data);
}

async function loadPatientContext(db: DbClient, clinicId: string, patientId: string) {
  const { data, error } = await db
    .from("patients")
    .select("id, insurance_provider, insurance_number, insurance_plan, document_number")
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (error) return serviceErr(error.message);
  if (!data) return serviceErr("Paciente no encontrado en esta clínica.");
  return serviceOk(data);
}

async function loadProfessionalContext(db: DbClient, clinicId: string, professionalId: string) {
  const { data, error } = await db
    .from("professionals")
    .select("id, license_national, license_provincial, specialties(name)")
    .eq("id", professionalId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (error) return serviceErr(error.message);
  if (!data) return serviceErr("Profesional no encontrado en esta clínica.");
  const specialty = data.specialties as { name?: string } | { name?: string }[] | null;
  const specialtyName = Array.isArray(specialty) ? specialty[0]?.name : specialty?.name;
  return serviceOk({
    id: data.id as string,
    license_national: data.license_national as string | null,
    license_provincial: data.license_provincial as string | null,
    specialty_name: specialtyName ?? null,
  });
}

async function loadClinicRuleOverride(
  db: DbClient,
  clinicId: string,
  coverageKind: string
): Promise<Partial<CoverageRuleConfig> | null> {
  const rulesResult = await loadActiveCoverageRulesForClinic(db, clinicId);
  if (!rulesResult.ok) return null;
  const match = rulesResult.data.find((row) => row.coverage_kind === coverageKind);
  return match?.rules ?? null;
}

function buildDraftRow(
  clinicId: string,
  userId: string,
  parsed: PrescriptionDraftInput
): PrescriptionDraftInsertRow {
  return {
    clinic_id: clinicId,
    patient_id: parsed.patient_id,
    clinical_record_id: parsed.clinical_record_id ?? null,
    professional_id: parsed.professional_id,
    prescription_type: parsed.prescription_type,
    diagnosis_cie10: sanitizeText(parsed.diagnosis_cie10),
    diagnosis_text: sanitizeText(parsed.diagnosis_text),
    patient_insurance: parsed.patient_insurance ? sanitizeText(parsed.patient_insurance) : null,
    coverage_kind: parsed.coverage_kind ?? null,
    insurance_number: parsed.insurance_number ? sanitizeText(parsed.insurance_number) : null,
    insurance_plan: parsed.insurance_plan ? sanitizeText(parsed.insurance_plan) : null,
    medications: parsed.medications,
    notes: parsed.notes ? sanitizeText(parsed.notes) : null,
    validity_days: parsed.validity_days,
    disclaimer_accepted: parsed.disclaimer_accepted,
    status: "draft",
    refeps_status: "local",
    created_by: userId,
  };
}

async function recordPrescriptionEvent(
  db: DbClient,
  input: {
    prescriptionId: string;
    clinicId: string;
    actorId: string;
    eventType: "created" | "updated" | "validated" | "issued" | "voided" | "dispensed";
    payload?: Record<string, unknown>;
  }
) {
  await insertPrescriptionEvent(db, {
    prescription_id: input.prescriptionId,
    clinic_id: input.clinicId,
    event_type: input.eventType,
    actor_id: input.actorId,
    payload: input.payload,
  });
}

export async function savePrescriptionDraftRecord(
  db: DbClient,
  input: {
    clinicId: string;
    userId: string;
    parsed: PrescriptionDraftInputParsed;
    existingDraftId: string | null;
  }
): Promise<ServiceResult<ElectronicPrescription>> {
  const patientResult = await loadPatientContext(db, input.clinicId, input.parsed.patient_id);
  if (!patientResult.ok) return patientResult;

  const enriched = enrichDraftFromPatient(
    input.parsed as PrescriptionDraftInput,
    patientResult.data
  );

  const professionalResult = await loadProfessionalContext(
    db,
    input.clinicId,
    enriched.professional_id
  );
  if (!professionalResult.ok) return professionalResult;

  const ruleOverride = await loadClinicRuleOverride(
    db,
    input.clinicId,
    enriched.coverage_kind ?? "PARTICULAR"
  );

  const ctx = buildPrescriptionContext({
    clinicId: input.clinicId,
    patient: patientResult.data,
    professional: professionalResult.data,
    patientInsurance: enriched.patient_insurance,
    coverageKind: enriched.coverage_kind,
    clinicRuleOverrides: ruleOverride,
  });

  const validation = validatePrescriptionDraft(ctx, enriched, "draft");
  if (!validation.valid) {
    const firstError = validation.issues.find((issue) => issue.severity === "error");
    return serviceErr(firstError?.message ?? "Receta inválida.");
  }

  const row = buildDraftRow(input.clinicId, input.userId, enriched);

  if (input.existingDraftId) {
    const result = await updatePrescriptionDraft(db, input.existingDraftId, input.clinicId, row);
    if (!result.ok) return fromRepo(result);
    await recordPrescriptionEvent(db, {
      prescriptionId: result.data.id,
      clinicId: input.clinicId,
      actorId: input.userId,
      eventType: "updated",
    });
    return fromRepo(result);
  }

  const result = await insertPrescriptionDraft(db, row);
  if (!result.ok) return fromRepo(result);

  await recordPrescriptionEvent(db, {
    prescriptionId: result.data.id,
    clinicId: input.clinicId,
    actorId: input.userId,
    eventType: "created",
  });

  return fromRepo(result);
}

export type IssuePrescriptionResult =
  | { ok: true; data: ElectronicPrescription; created: boolean }
  | { ok: false; error: string };

export async function issuePrescriptionRecord(
  db: DbClient,
  draftId: string,
  clinicId: string,
  userId: string,
  idempotencyKey?: string | null
): Promise<IssuePrescriptionResult> {
  const normalizedKey = idempotencyKey?.trim() || null;

  if (normalizedKey) {
    const existing = await findPrescriptionByIdempotencyKey(db, clinicId, normalizedKey);
    if (!existing.ok) return { ok: false, error: existing.error };
    if (existing.data) {
      return { ok: true, data: existing.data, created: false };
    }
  }

  const draftResult = await getPrescriptionDraftForIssue(db, draftId, clinicId);
  if (!draftResult.ok) return { ok: false, error: draftResult.error };
  if (!draftResult.data) return { ok: false, error: "Receta no encontrada." };
  const draft = draftResult.data;

  if (draft.status === "issued") {
    return { ok: true, data: draft, created: false };
  }
  if (draft.status !== "draft") {
    return { ok: false, error: "Solo se pueden emitir recetas en borrador." };
  }

  const patientResult = await loadPatientContext(db, clinicId, draft.patient_id);
  if (!patientResult.ok) return { ok: false, error: patientResult.error };

  const professionalResult = await loadProfessionalContext(db, clinicId, draft.professional_id);
  if (!professionalResult.ok) return { ok: false, error: professionalResult.error };

  const authoritative = resolveAuthoritativeCoverageForIssue(patientResult.data, {
    patient_insurance: draft.patient_insurance,
    coverage_kind: draft.coverage_kind,
    insurance_number: draft.insurance_number,
    insurance_plan: draft.insurance_plan,
  });
  const ruleOverride = await loadClinicRuleOverride(
    db,
    clinicId,
    authoritative.coverageKind
  );

  const ctx = buildPrescriptionContext({
    clinicId,
    patient: patientResult.data,
    professional: professionalResult.data,
    patientInsurance: authoritative.patientInsurance,
    coverageKind: authoritative.coverageKind,
    clinicRuleOverrides: ruleOverride,
  });

  const engineDraft = {
    patient_id: draft.patient_id,
    professional_id: draft.professional_id,
    clinical_record_id: draft.clinical_record_id,
    prescription_type: draft.prescription_type,
    diagnosis_cie10: draft.diagnosis_cie10 ?? "",
    diagnosis_text: draft.diagnosis_text ?? "",
    medications: draft.medications,
    notes: draft.notes,
    validity_days: draft.validity_days,
    patient_insurance: authoritative.patientInsurance,
    coverage_kind: authoritative.coverageKind,
    insurance_number: authoritative.insuranceNumber,
    insurance_plan: authoritative.insurancePlan,
    disclaimer_accepted: draft.disclaimer_accepted,
  };

  const validation = validatePrescriptionDraft(ctx, engineDraft, "issue");
  if (!validation.valid) {
    const firstError = validation.issues.find((issue) => issue.severity === "error");
    return { ok: false, error: firstError?.message ?? "No se puede emitir la receta." };
  }

  await recordPrescriptionEvent(db, {
    prescriptionId: draft.id,
    clinicId,
    actorId: userId,
    eventType: "validated",
    payload: { coverage_kind: ctx.coverageKind },
  });

  const issuePatch = {
    patient_insurance: engineDraft.patient_insurance,
    coverage_kind: ctx.coverageKind,
    insurance_number: engineDraft.insurance_number,
    insurance_plan: engineDraft.insurance_plan,
    idempotency_key: normalizedKey,
  };

  const issued = await issuePrescriptionDraft(db, draftId, clinicId, issuePatch);
  if (!issued.ok) {
    if (normalizedKey && isPrescriptionUniqueViolation(issued.error)) {
      const raced = await findPrescriptionByIdempotencyKey(db, clinicId, normalizedKey);
      if (raced.ok && raced.data) {
        return { ok: true, data: raced.data, created: false };
      }
      return { ok: false, error: PRESCRIPTION_IDEMPOTENCY_CONFLICT };
    }
    return { ok: false, error: issued.error };
  }

  await recordPrescriptionEvent(db, {
    prescriptionId: draft.id,
    clinicId,
    actorId: userId,
    eventType: "issued",
    payload: {
      prescription_number: issued.data.prescription_number,
      coverage_kind: ctx.coverageKind,
    },
  });

  return { ok: true, data: issued.data, created: true };
}

export async function voidPrescriptionRecord(
  db: DbClient,
  draftId: string,
  clinicId: string,
  userId: string
): Promise<ServiceResult<ElectronicPrescription>> {
  const result = await voidPrescriptionDraft(db, draftId, clinicId);
  if (!result.ok) return fromRepo(result);

  await recordPrescriptionEvent(db, {
    prescriptionId: draftId,
    clinicId,
    actorId: userId,
    eventType: "voided",
  });

  return fromRepo(result);
}

export async function markPrescriptionDispensedRecord(
  db: DbClient,
  prescriptionId: string,
  clinicId: string,
  userId: string
): Promise<ServiceResult<ElectronicPrescription>> {
  const result = await markPrescriptionDispensedRow(db, prescriptionId, clinicId);
  if (!result.ok) return fromRepo(result);

  await recordPrescriptionEvent(db, {
    prescriptionId,
    clinicId,
    actorId: userId,
    eventType: "dispensed",
  });

  return fromRepo(result);
}

export function formatPrescriptionValidationErrors(
  issues: ReturnType<typeof validatePrescriptionDraft>["issues"]
): string {
  return issues
    .filter((issue) => issue.severity === "error")
    .map((issue) => issue.message)
    .join(" ");
}
