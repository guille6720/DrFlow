import "server-only";

import { randomUUID } from "node:crypto";

import { getPrescriberMfaStatus } from "@/core/auth/prescriber-mfa.server";
import { getActiveClinicId, getPermissionContext, getSession } from "@/core/auth/session.server";
import { isFeatureEnabled } from "@/core/customizations/customizations.server";
import { emitStructuredLog, hashClinicScope } from "@/core/observability/structured-log";
import { hasPermission } from "@/core/permissions/roles";
import { hasProduct } from "@/core/products/product-access";
import { PRODUCTS } from "@/core/products/products";
import { loadClinicProducts } from "@/core/products/products.server";
import { asStagingSchemaClient, type StagingSchemaClient } from "@/core/products/staging-schema-client";
import { validateProfessionalWithRefeps } from "@/core/refeps/professional-validation";
import { isRefepsForcedOutage } from "@/core/renapdis/external-outage";
import {
  cancelNationalPrescription,
  refreshNationalPrescriptionStatus,
  submitNationalPrescription,
} from "@/core/renapdis/national-prescription/orchestrator";
import type {
  NationalRxActor,
  NationalRxAuditEvent,
  NationalRxAuditMetadata,
  NationalRxDataSource,
  NationalRxDeps,
  NationalRxGates,
  NationalRxPatch,
  NationalRxRecord,
  NationalRxResult,
  NationalRxStore,
} from "@/core/renapdis/national-prescription/types";
import { evaluateNationalRxReadiness, type NationalRxReadiness } from "@/core/renapdis/national-readiness";
import { isNationalRxState } from "@/core/renapdis/national-state-machine";
import { resolveRepositoryProvider } from "@/core/renapdis/providers";
import { resolveRepositoryConfig } from "@/core/renapdis/repository/repository-config";
import { validateNationalPrescriptionRequest } from "@/core/renapdis/repository/repository-validation";
import { recordAudit } from "@/core/security/audit-service";
import { createAdminClient } from "@/core/supabase/admin";
import { createClient } from "@/core/supabase/server";

export const NATIONAL_RX_FEATURE_KEY = "national_electronic_prescription" as const;

const NATIONAL_COLUMNS =
  "id, clinic_id, status, professional_id, patient_id, national_rx_state, national_rx_updated_at, national_submission_id, national_idempotency_key, national_correlation_id, national_attempts, repository_provider, repository_mode, repository_prescription_id, repository_status, sandbox_reference, cuir, repository_error_code, refeps_professional_status, refeps_validation_mode";

function mapRecord(row: Record<string, unknown>): NationalRxRecord {
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  const mode = str(row.repository_mode);
  return {
    id: String(row.id),
    clinicId: String(row.clinic_id),
    status: String(row.status ?? ""),
    professionalId: str(row.professional_id),
    patientId: str(row.patient_id),
    nationalState: isNationalRxState(row.national_rx_state) ? row.national_rx_state : null,
    nationalUpdatedAt: str(row.national_rx_updated_at),
    submissionId: str(row.national_submission_id),
    idempotencyKey: str(row.national_idempotency_key),
    correlationId: str(row.national_correlation_id),
    attempts: typeof row.national_attempts === "number" ? row.national_attempts : 0,
    repositoryProvider: str(row.repository_provider),
    repositoryMode: mode === "sandbox" || mode === "external" ? mode : null,
    repositoryPrescriptionId: str(row.repository_prescription_id),
    repositoryStatus: str(row.repository_status),
    sandboxReference: str(row.sandbox_reference),
    cuir: str(row.cuir),
    errorCode: str(row.repository_error_code),
    refepsProfessionalStatus: str(row.refeps_professional_status),
    refepsValidationMode: str(row.refeps_validation_mode),
  };
}

/**
 * Reads go through the user's RLS client (proves clinic access); national-column writes go through
 * service_role (DB trigger rejects any other writer) and are always scoped by the server clinic id.
 */
function createSupabaseStore(userDb: StagingSchemaClient, adminDb: SupabaseLike): NationalRxStore {
  return {
    async load(prescriptionId, clinicId) {
      const { data, error } = await userDb
        .from("prescription_drafts")
        .select(NATIONAL_COLUMNS)
        .eq("id", prescriptionId)
        .eq("clinic_id", clinicId)
        .maybeSingle();
      if (error || !data) return null;
      return mapRecord(data);
    },
    async update(prescriptionId, clinicId, expectedUpdatedAt, patch: NationalRxPatch) {
      let query = adminDb
        .from("prescription_drafts")
        .update({ ...patch, national_rx_updated_at: new Date().toISOString() })
        .eq("id", prescriptionId)
        .eq("clinic_id", clinicId);
      query = expectedUpdatedAt ? query.eq("national_rx_updated_at", expectedUpdatedAt) : query.is("national_rx_updated_at", null);
      const { data, error } = await query.select(NATIONAL_COLUMNS).maybeSingle();
      if (error) {
        emitStructuredLog({
          level: "warn",
          event: "national_rx.store_update_failed",
          operation: "national_rx",
          clinic_scope_hash: hashClinicScope(clinicId),
          error_code: (error.code ?? error.message ?? "unknown").slice(0, 80),
        });
        return null;
      }
      return data ? mapRecord(data as Record<string, unknown>) : null;
    },
  };
}

type SupabaseLike = {
  from: (table: string) => {
    update: (row: Record<string, unknown>) => UpdateChain;
  };
};
type UpdateChain = {
  eq: (column: string, value: unknown) => UpdateChain;
  is: (column: string, value: null) => UpdateChain;
  select: (columns: string) => {
    maybeSingle: () => PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
  };
};

function createSupabaseDataSource(userDb: StagingSchemaClient): NationalRxDataSource {
  return {
    async buildSubmission(record, submissionId, establishmentCode) {
      const [{ data: rx }, { data: patient }, { data: pro }] = await Promise.all([
        userDb
          .from("prescription_drafts")
          .select("id, prescription_number, issued_at, validity_days, prescription_category, diagnosis_cie10, diagnosis_text, medications")
          .eq("id", record.id)
          .eq("clinic_id", record.clinicId)
          .maybeSingle(),
        userDb
          .from("patients")
          .select("id, first_name, last_name, document_type, document_number, cuil, birth_date, sex, insurance_provider, insurance_number")
          .eq("id", record.patientId ?? "")
          .eq("clinic_id", record.clinicId)
          .maybeSingle(),
        userDb
          .from("professionals")
          .select("id, cuil, tax_id, license_number, license_national, license_provincial, licensing_jurisdiction, refeps_identifier, refeps_specialty")
          .eq("id", record.professionalId ?? "")
          .eq("clinic_id", record.clinicId)
          .maybeSingle(),
      ]);
      if (!rx) return { ok: false, code: "invalid_prescription" };
      if (!patient) return { ok: false, code: "invalid_patient" };
      if (!pro) return { ok: false, code: "invalid_professional" };

      const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
      const meds = Array.isArray(rx.medications) ? (rx.medications as Record<string, unknown>[]) : [];
      const license = s(pro.license_national) ?? s(pro.license_provincial) ?? s(pro.license_number);
      const professionalDocument = (s(pro.cuil) ?? s(pro.tax_id))?.replace(/\D+/g, "") ?? null;
      const issuedAt = s(rx.issued_at);

      const request = {
        submissionId,
        prescriptionId: record.id,
        prescriptionNumber: s(rx.prescription_number),
        issuedAt: issuedAt ? new Date(issuedAt).toISOString() : "",
        validityDays: typeof rx.validity_days === "number" ? rx.validity_days : 30,
        category: s(rx.prescription_category) ?? "medication",
        establishment: { code: establishmentCode },
        professional: {
          refepsProfessionalId: s(pro.refeps_identifier),
          documentNumber: professionalDocument,
          licenseNumber: license ?? "",
          licenseJurisdiction: s(pro.licensing_jurisdiction),
          profession: s(pro.refeps_specialty),
        },
        patient: {
          documentType: s(patient.document_type) ?? "dni",
          documentNumber: s(patient.document_number),
          cuil: s(patient.cuil),
          firstName: s(patient.first_name) ?? "",
          lastName: s(patient.last_name) ?? "",
          birthDate: s(patient.birth_date),
          sex: s(patient.sex),
          coverage: s(patient.insurance_provider)
            ? { provider: s(patient.insurance_provider), memberNumber: s(patient.insurance_number) }
            : null,
        },
        diagnosis: {
          code: s(rx.diagnosis_cie10),
          system: s(rx.diagnosis_cie10) ? ("CIE-10" as const) : null,
          text: s(rx.diagnosis_text),
        },
        items: meds.map((m) => ({
          genericName: s(m.generic_name) ?? "",
          presentation: s(m.presentation),
          quantity: typeof m.quantity === "number" ? m.quantity : Number(m.quantity) || 0,
          posology: s(m.posology) ?? "",
        })),
      };

      const check = validateNationalPrescriptionRequest(request);
      if (!check.ok) return { ok: false, code: check.code };
      return {
        ok: true,
        request,
        refepsInput: {
          documentNumber: professionalDocument,
          licenseNumber: license,
          profession: s(pro.refeps_specialty),
          jurisdiction: s(pro.licensing_jurisdiction),
        },
      };
    },
  };
}

const AUDIT_WHAT: Record<NationalRxAuditEvent, string> = {
  refeps_validation_requested: "Receta nacional: validación REFEPS solicitada",
  refeps_validation_success: "Receta nacional: validación REFEPS exitosa",
  refeps_validation_failed: "Receta nacional: validación REFEPS fallida",
  repository_submission_requested: "Receta nacional: envío a repositorio solicitado",
  repository_submission_success: "Receta nacional: registrada en repositorio",
  repository_submission_failed: "Receta nacional: envío a repositorio fallido",
  cuir_received: "Receta nacional: CUIR recibido del repositorio",
  cuir_verified: "Receta nacional: CUIR verificado",
  cuir_verification_failed: "Receta nacional: verificación de CUIR fallida",
  national_prescription_blocked: "Receta nacional: envío bloqueado",
  national_prescription_cancelled: "Receta nacional: anulada",
};

function auditSink(userId: string) {
  return async (event: NationalRxAuditEvent, metadata: NationalRxAuditMetadata) => {
    await recordAudit({
      clinicId: metadata.clinic_id,
      module: "compliance",
      entityType: "prescription",
      entityId: metadata.prescription_id,
      action: event === "national_prescription_cancelled" ? "update" : "view",
      what: AUDIT_WHAT[event],
      userId,
      metadata: { event, channel: "national_electronic", ...metadata },
    });
  };
}

export type NationalRxSessionContext = {
  actor: NationalRxActor;
  gates: NationalRxGates;
  readiness: NationalRxReadiness;
};

/** Everything derived from the authenticated session — never from client input. */
export async function resolveNationalRxSession(): Promise<NationalRxSessionContext | null> {
  const [user, clinicId, perm] = await Promise.all([getSession(), getActiveClinicId(), getPermissionContext()]);
  if (!user || !clinicId) return null;

  const userDb = asStagingSchemaClient(await createClient());
  const [featureEnabled, products, clinicRow, mfa] = await Promise.all([
    isFeatureEnabled(clinicId, NATIONAL_RX_FEATURE_KEY),
    loadClinicProducts(clinicId),
    userDb.from("clinics").select("id, refeps_establishment_code").eq("id", clinicId).maybeSingle(),
    getPrescriberMfaStatus().catch(() => ({ elevated: false })),
  ]);
  const establishmentCode =
    typeof clinicRow.data?.refeps_establishment_code === "string" ? clinicRow.data.refeps_establishment_code : null;
  const productEntitled = hasProduct(products, PRODUCTS.CLINIC);

  return {
    actor: { clinicId, userId: user.id },
    gates: {
      hasPermission: hasPermission(perm.role, "issuePrescriptions", perm.isSuperadmin, perm.permissionOverrides),
      productEntitled,
      featureEnabled,
      mfaElevated: Boolean(mfa.elevated),
      establishmentCode,
    },
    readiness: evaluateNationalRxReadiness({ featureEnabled, productEntitled, establishmentCode }),
  };
}

async function buildDeps(userId: string): Promise<NationalRxDeps> {
  const userDb = asStagingSchemaClient(await createClient());
  const repositoryConfig = resolveRepositoryConfig();
  return {
    store: createSupabaseStore(userDb, createAdminClient() as unknown as SupabaseLike),
    data: createSupabaseDataSource(userDb),
    audit: auditSink(userId),
    provider: resolveRepositoryProvider(repositoryConfig),
    repositoryConfig,
    validateProfessional: async (input) =>
      isRefepsForcedOutage()
        ? { valid: false, status: "unavailable", mode: "unavailable" }
        : validateProfessionalWithRefeps(input),
    uuid: randomUUID,
  };
}

const NO_SESSION: NationalRxResult = {
  ok: false,
  code: "permission_denied",
  message: "Sesión requerida.",
  state: null,
  recoverable: false,
};

export async function submitNationalPrescriptionForSession(prescriptionId: string): Promise<NationalRxResult> {
  const session = await resolveNationalRxSession();
  if (!session) return NO_SESSION;
  const deps = await buildDeps(session.actor.userId);
  return submitNationalPrescription(session.actor, session.gates, prescriptionId, deps);
}

export async function refreshNationalPrescriptionForSession(prescriptionId: string): Promise<NationalRxResult> {
  const session = await resolveNationalRxSession();
  if (!session) return NO_SESSION;
  const deps = await buildDeps(session.actor.userId);
  return refreshNationalPrescriptionStatus(session.actor, session.gates, prescriptionId, deps);
}

export async function cancelNationalPrescriptionForSession(
  prescriptionId: string,
  reasonCode: string
): Promise<NationalRxResult> {
  const session = await resolveNationalRxSession();
  if (!session) return NO_SESSION;
  const deps = await buildDeps(session.actor.userId);
  return cancelNationalPrescription(session.actor, session.gates, prescriptionId, reasonCode, deps);
}

export type NationalRxStatusView = {
  prescriptionId: string;
  state: NationalRxRecord["nationalState"];
  refepsProfessionalStatus: string | null;
  refepsValidationMode: string | null;
  repositoryMode: NationalRxRecord["repositoryMode"];
  repositoryProvider: string | null;
  repositoryStatus: string | null;
  sandboxReference: string | null;
  cuir: string | null;
  errorCode: string | null;
};

export async function loadNationalPrescriptionStatus(prescriptionId: string): Promise<NationalRxStatusView | null> {
  const session = await resolveNationalRxSession();
  if (!session || !session.gates.featureEnabled) return null;
  const userDb = asStagingSchemaClient(await createClient());
  const { data, error } = await userDb
    .from("prescription_drafts")
    .select(NATIONAL_COLUMNS)
    .eq("id", prescriptionId)
    .eq("clinic_id", session.actor.clinicId)
    .maybeSingle();
  if (error || !data) return null;
  const r = mapRecord(data);
  return {
    prescriptionId: r.id,
    state: r.nationalState,
    refepsProfessionalStatus: r.refepsProfessionalStatus,
    refepsValidationMode: r.refepsValidationMode,
    repositoryMode: r.repositoryMode,
    repositoryProvider: r.repositoryProvider,
    repositoryStatus: r.repositoryStatus,
    sandboxReference: r.sandboxReference,
    cuir: r.cuir,
    errorCode: r.errorCode,
  };
}
