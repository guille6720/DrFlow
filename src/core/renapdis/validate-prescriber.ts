import "server-only";

import { resolveProfessionalValidationAdapter } from "@/core/renapdis/adapters";
import type {
  PrescriberIdentityInput,
  PrescriberValidationIssue,
  RefepsValidationStatus,
  ValidatePrescriberResult,
} from "@/core/renapdis/types";
import {
  allowsNationalElectronicPrescription,
  hasAnyProfessionalLicense,
  isRefepsValidationStatus,
  resolveEffectiveCuil,
} from "@/core/renapdis/types";
import type { DbClient } from "@/core/repositories/types";
import { recordAudit } from "@/core/security/audit-service";

export type ProfessionalValidationRow = {
  id: string;
  clinic_id: string;
  display_name: string | null;
  cuil: string | null;
  tax_id: string | null;
  license_number: string | null;
  license_national: string | null;
  license_provincial: string | null;
  licensing_jurisdiction: string | null;
  issuing_authority: string | null;
  refeps_specialty: string | null;
  refeps_identifier: string | null;
  refeps_validation_status: string | null;
  refeps_validated_at: string | null;
  refeps_validation_error: string | null;
  refeps_validation_details: Record<string, unknown> | null;
  is_active: boolean | null;
  specialties?: { name?: string } | { name?: string }[] | null;
};

const PROFESSIONAL_VALIDATION_COLUMNS =
  "id, clinic_id, display_name, cuil, tax_id, license_number, license_national, license_provincial, licensing_jurisdiction, issuing_authority, refeps_specialty, refeps_identifier, refeps_validation_status, refeps_validated_at, refeps_validation_error, refeps_validation_details, is_active, specialties(name)";

function specialtyName(row: ProfessionalValidationRow): string | null {
  const specialty = row.specialties;
  if (Array.isArray(specialty)) return specialty[0]?.name ?? row.refeps_specialty ?? null;
  return specialty?.name ?? row.refeps_specialty ?? null;
}

export function mapProfessionalToIdentityInput(
  row: ProfessionalValidationRow
): PrescriberIdentityInput {
  const statusRaw = row.refeps_validation_status;
  const currentStatus: RefepsValidationStatus = isRefepsValidationStatus(statusRaw)
    ? statusRaw
    : "not_configured";

  return {
    professionalId: row.id,
    clinicId: row.clinic_id,
    displayName: row.display_name,
    cuil: row.cuil,
    taxId: row.tax_id,
    licenseNumber: row.license_number,
    licenseNational: row.license_national,
    licenseProvincial: row.license_provincial,
    licensingJurisdiction: row.licensing_jurisdiction,
    issuingAuthority: row.issuing_authority,
    specialty: specialtyName(row),
    refepsIdentifier: row.refeps_identifier,
    currentStatus,
  };
}

export function collectLocalIdentityIssues(
  input: PrescriberIdentityInput
): PrescriberValidationIssue[] {
  const issues: PrescriberValidationIssue[] = [];
  if (!resolveEffectiveCuil(input)) {
    issues.push({
      code: "missing_cuil",
      message: "Falta CUIL del profesional.",
    });
  }
  if (!hasAnyProfessionalLicense(input)) {
    issues.push({
      code: "missing_license",
      message: "Falta matrícula profesional.",
    });
  }
  return issues;
}

/**
 * Pure gate: can this professional identity authorize national e-Rx right now?
 * Does not call adapters — uses persisted validation status + local identity.
 */
export function evaluateNationalPrescriptionEligibility(
  input: PrescriberIdentityInput
): ValidatePrescriberResult {
  const localIssues = collectLocalIdentityIssues(input);
  if (localIssues.length > 0) {
    return {
      ok: false,
      status: input.currentStatus,
      issues: localIssues,
      details: { gate: "national_electronic" },
      error: localIssues.map((i) => i.message).join(" "),
    };
  }

  if (!allowsNationalElectronicPrescription(input.currentStatus)) {
    const code =
      input.currentStatus === "pending"
        ? "refeps_pending"
        : input.currentStatus === "failed"
          ? "refeps_failed"
          : "refeps_not_configured";
    const message =
      input.currentStatus === "pending"
        ? "La validación REFEPS del profesional está pendiente."
        : input.currentStatus === "failed"
          ? "La validación REFEPS del profesional falló. Revisá identidad y reintentá."
          : "El profesional no está validado en REFEPS (estado: no configurado).";
    return {
      ok: false,
      status: input.currentStatus,
      issues: [{ code, message }],
      details: { gate: "national_electronic" },
      error: message,
    };
  }

  return {
    ok: true,
    status: input.currentStatus,
    issues: [],
    details: { gate: "national_electronic", status: input.currentStatus },
  };
}

export async function loadProfessionalForValidation(
  db: DbClient,
  clinicId: string,
  professionalId: string
): Promise<{ ok: true; data: ProfessionalValidationRow } | { ok: false; error: string }> {
  const { data, error } = await db
    .from("professionals")
    .select(PROFESSIONAL_VALIDATION_COLUMNS)
    .eq("id", professionalId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Profesional no encontrado en esta clínica." };
  return { ok: true, data: data as unknown as ProfessionalValidationRow };
}

/**
 * Server-side professional validation for ReNaPDiS Phase 1.
 * Never trust client-side validation. Uses pluggable adapters; staging defaults to sandbox.
 */
export async function validatePrescriber(
  db: DbClient,
  input: {
    clinicId: string;
    professionalId: string;
    actorUserId: string;
    /** Force official path (will report not_configured until Ministry adapter exists). */
    preferOfficial?: boolean;
    persist?: boolean;
  }
): Promise<ValidatePrescriberResult> {
  const loaded = await loadProfessionalForValidation(db, input.clinicId, input.professionalId);
  if (!loaded.ok) {
    const result: ValidatePrescriberResult = {
      ok: false,
      status: "failed",
      issues: [{ code: "invalid_professional", message: loaded.error }],
      details: { clinicId: input.clinicId, professionalId: input.professionalId },
      error: loaded.error,
    };
    await recordAudit({
      clinicId: input.clinicId,
      module: "compliance",
      entityType: "professional",
      entityId: input.professionalId,
      action: "view",
      what: "Intento de validación profesional REFEPS fallido (profesional inválido)",
      userId: input.actorUserId,
      metadata: {
        event: "professional_validation_attempt",
        outcome: "failure",
        reason: "invalid_professional",
      },
    });
    return result;
  }

  // Cross-clinic isolation: query already scoped by clinic_id; double-check.
  if (loaded.data.clinic_id !== input.clinicId) {
    const result: ValidatePrescriberResult = {
      ok: false,
      status: "failed",
      issues: [
        {
          code: "cross_clinic",
          message: "El profesional no pertenece a la clínica activa.",
        },
      ],
      details: {},
      error: "El profesional no pertenece a la clínica activa.",
    };
    await recordAudit({
      clinicId: input.clinicId,
      module: "compliance",
      entityType: "professional",
      entityId: input.professionalId,
      action: "view",
      what: "Validación profesional bloqueada por aislamiento entre clínicas",
      userId: input.actorUserId,
      metadata: {
        event: "professional_validation_attempt",
        outcome: "failure",
        reason: "cross_clinic",
      },
    });
    return result;
  }

  const identity = mapProfessionalToIdentityInput(loaded.data);

  await recordAudit({
    clinicId: input.clinicId,
    module: "compliance",
    entityType: "professional",
    entityId: input.professionalId,
    action: "view",
    what: "Intento de validación profesional REFEPS",
    userId: input.actorUserId,
    metadata: {
      event: "professional_validation_attempt",
      previous_status: identity.currentStatus,
      prefer_official: Boolean(input.preferOfficial),
    },
  });

  const adapter = resolveProfessionalValidationAdapter({
    preferOfficial: input.preferOfficial,
    officialConfigured: false,
  });

  const adapterResult = await adapter.validate(identity);
  const status = adapterResult.status;
  const ok = status === "sandbox" || status === "validated";
  const persist = input.persist !== false;
  const nowIso = new Date().toISOString();

  if (persist) {
    const { error: updateError } = await db
      .from("professionals")
      .update({
        refeps_validation_status: status,
        refeps_validated_at: nowIso,
        refeps_validation_error: adapterResult.error ?? null,
        refeps_validation_details: adapterResult.details ?? null,
        updated_at: nowIso,
      } as never)
      .eq("id", input.professionalId)
      .eq("clinic_id", input.clinicId);

    if (updateError) {
      return {
        ok: false,
        status: "failed",
        issues: [
          {
            code: "refeps_validation_failure",
            message: `No se pudo persistir el resultado de validación: ${updateError.message}`,
          },
        ],
        details: adapterResult.details ?? {},
        error: updateError.message,
      };
    }
  }

  await recordAudit({
    clinicId: input.clinicId,
    module: "compliance",
    entityType: "professional",
    entityId: input.professionalId,
    action: "update",
    what: ok
      ? `Validación profesional REFEPS exitosa (${status})`
      : `Validación profesional REFEPS fallida (${status})`,
    userId: input.actorUserId,
    metadata: {
      event: ok ? "professional_validation_success" : "professional_validation_failure",
      status,
      adapter: adapter.id,
      error: adapterResult.error ?? null,
    },
  });

  if (!ok) {
    return {
      ok: false,
      status,
      issues: [
        {
          code: "refeps_validation_failure",
          message: adapterResult.error ?? "Validación REFEPS fallida.",
        },
      ],
      details: adapterResult.details ?? {},
      error: adapterResult.error ?? "Validación REFEPS fallida.",
    };
  }

  return {
    ok: true,
    status,
    issues: [],
    details: adapterResult.details ?? {},
  };
}
