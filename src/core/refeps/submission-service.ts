import "server-only";

import { getPrescriberMfaStatus } from "@/core/auth/prescriber-mfa.server";
import { submitPrescriptionToRefepsProvider } from "@/core/refeps/provider";
import type { RefepsClinicSettings } from "@/core/refeps/types";
import type { CuirStatus } from "@/core/renapdis/cuir";
import { isCuirStatus } from "@/core/renapdis/cuir";
import type { PatientIdentityInput } from "@/core/renapdis/patient-identity";
import { prepareNationalRxArtifacts } from "@/core/renapdis/prepare-national-rx";
import {
  evaluateNationalPrescriptionEligibility,
  loadProfessionalForValidation,
  mapProfessionalToIdentityInput,
} from "@/core/renapdis/validate-prescriber";
import type { DbClient } from "@/core/repositories/types";
import { recordAudit } from "@/core/security/audit-service";

import { updatePrescriptionRefepsState } from "@/features/recetas/repositories/prescription-drafts.repository";
import { insertPrescriptionEvent } from "@/features/recetas/repositories/prescription-events.repository";

import { buildProfessionalSignature, getProfessionalDisplayName } from "@/lib/utils/professional";
import type { ElectronicPrescription, PrescriptionMedication } from "@/types/prescription";

export type ClinicRefepsRow = {
  id: string;
  name: string;
  refeps_enabled: boolean;
  refeps_establishment_code: string | null;
  refeps_auto_submit: boolean;
};

export async function loadClinicRefepsRow(
  db: DbClient,
  clinicId: string
): Promise<ClinicRefepsRow | null> {
  const { data, error } = await db
    .from("clinics")
    .select("id, name, refeps_enabled, refeps_establishment_code, refeps_auto_submit")
    .eq("id", clinicId)
    .maybeSingle();

  if (error || !data) return null;
  return data as ClinicRefepsRow;
}

export function mapClinicRefepsSettings(row: ClinicRefepsRow): RefepsClinicSettings {
  return {
    enabled: row.refeps_enabled,
    establishmentCode: row.refeps_establishment_code,
    autoSubmit: row.refeps_auto_submit,
  };
}

function mapPatientIdentity(
  patient: Record<string, unknown>,
  clinicId: string
): PatientIdentityInput {
  return {
    patientId: String(patient.id),
    clinicId,
    firstName: (patient.first_name as string | null) ?? null,
    lastName: (patient.last_name as string | null) ?? null,
    documentNumber: (patient.document_number as string | null) ?? null,
    documentType: (patient.document_type as PatientIdentityInput["documentType"]) ?? "dni",
    cuil: (patient.cuil as string | null) ?? null,
    altIdentifierType:
      (patient.alt_identifier_type as PatientIdentityInput["altIdentifierType"]) ?? null,
    altIdentifierValue: (patient.alt_identifier_value as string | null) ?? null,
    birthDate: (patient.birth_date as string | null) ?? null,
    sex: (patient.sex as PatientIdentityInput["sex"]) ?? null,
    insuranceProvider: (patient.insurance_provider as string | null) ?? null,
    address: (patient.address as string | null) ?? null,
  };
}

async function recordPhase2Audits(input: {
  clinicId: string;
  userId: string;
  prescriptionId: string;
  patientId: string;
  events: string[];
  extra?: Record<string, unknown>;
}) {
  for (const event of input.events) {
    await recordAudit({
      clinicId: input.clinicId,
      module: "compliance",
      entityType: "prescription",
      entityId: input.prescriptionId,
      patientId: input.patientId,
      action: "view",
      what: `ReNaPDiS Phase 2: ${event}`,
      userId: input.userId,
      metadata: {
        event,
        channel: "national_electronic",
        ...input.extra,
      },
    });
  }
}

export async function submitIssuedPrescriptionToRefeps(
  db: DbClient,
  input: {
    clinicId: string;
    userId: string;
    prescription: ElectronicPrescription;
  }
): Promise<
  | { ok: true; data: ElectronicPrescription }
  | { ok: false; error: string; data?: ElectronicPrescription }
> {
  const clinicRow = await loadClinicRefepsRow(db, input.clinicId);
  if (!clinicRow) return { ok: false, error: "Consultorio no encontrado." };

  const clinicSettings = mapClinicRefepsSettings(clinicRow);

  const [{ data: patient }, { data: professional }] = await Promise.all([
    db
      .from("patients")
      .select(
        "id, first_name, last_name, document_number, document_type, cuil, alt_identifier_type, alt_identifier_value, birth_date, sex, address, insurance_provider, insurance_number"
      )
      .eq("id", input.prescription.patient_id)
      .eq("clinic_id", input.clinicId)
      .maybeSingle(),
    db
      .from("professionals")
      .select(
        "id, display_name, license_number, license_national, license_provincial, signature_text, profiles(full_name), specialties(name)"
      )
      .eq("id", input.prescription.professional_id)
      .eq("clinic_id", input.clinicId)
      .maybeSingle(),
  ]);

  if (!patient) return { ok: false, error: "Paciente no encontrado." };
  if (!professional) return { ok: false, error: "Profesional no encontrado." };

  const validationRow = await loadProfessionalForValidation(
    db,
    input.clinicId,
    input.prescription.professional_id
  );
  if (!validationRow.ok) {
    await recordAudit({
      clinicId: input.clinicId,
      module: "compliance",
      entityType: "prescription",
      entityId: input.prescription.id,
      patientId: input.prescription.patient_id,
      action: "view",
      what: "Receta nacional bloqueada: profesional inválido para REFEPS",
      userId: input.userId,
      metadata: {
        event: "national_prescription_blocked",
        reason: "invalid_professional",
        channel: "national_electronic",
      },
    });
    return { ok: false, error: validationRow.error };
  }

  const identity = mapProfessionalToIdentityInput(validationRow.data);
  const eligibility = evaluateNationalPrescriptionEligibility(identity);
  if (!eligibility.ok) {
    await recordAudit({
      clinicId: input.clinicId,
      module: "compliance",
      entityType: "prescription",
      entityId: input.prescription.id,
      patientId: input.prescription.patient_id,
      action: "view",
      what: `Receta nacional bloqueada: ${eligibility.error}`,
      userId: input.userId,
      metadata: {
        event: "national_prescription_blocked",
        reason: eligibility.issues[0]?.code ?? "refeps_validation_failure",
        channel: "national_electronic",
        refeps_validation_status: eligibility.status,
      },
    });
    return { ok: false, error: eligibility.error };
  }

  const mfa = await getPrescriberMfaStatus();
  const patientIdentity = mapPatientIdentity(patient as Record<string, unknown>, input.clinicId);
  const medications = (Array.isArray(input.prescription.medications)
    ? input.prescription.medications
    : []) as PrescriptionMedication[];

  const prepared = await prepareNationalRxArtifacts({
    authenticated: true,
    clinicMember: true,
    hasIssuePermission: true,
    mfa: { enrolled: mfa.enrolled, elevated: mfa.elevated },
    professional: identity,
    patient: patientIdentity,
    prescription: {
      hasDiagnosis: Boolean(input.prescription.diagnosis_text?.trim()),
      hasMedicationsOrItems: medications.length > 0,
      issueDatePresent: Boolean(input.prescription.issued_at),
    },
    cuir: {
      status: isCuirStatus(input.prescription.cuir_status)
        ? input.prescription.cuir_status
        : ("pending_official_ids" satisfies CuirStatus),
      components: {
        platformId: input.prescription.cuir_platform_id ?? undefined,
        repositoryId: input.prescription.cuir_repository_id ?? undefined,
        jurisdiction: input.prescription.cuir_jurisdiction ?? undefined,
        typeSubtype: input.prescription.cuir_type_subtype ?? undefined,
        groupId: input.prescription.cuir_group_id ?? undefined,
        itemNumber: input.prescription.cuir_item_number ?? undefined,
      },
    },
    officialIds: {
      // DNSISA-assigned ids only — intentionally unset until officially provided.
      platformId: null,
      repositoryId: null,
    },
    allowSandbox: true,
    prescriptionId: input.prescription.id,
    prescriptionType: input.prescription.prescription_type,
    diagnosisText: input.prescription.diagnosis_text,
    medications: medications.map((m) => ({
      genericName: m.generic_name,
      quantity: m.quantity,
      posology: m.posology,
      presentation: m.presentation ?? null,
    })),
    patientForFhir: {
      id: String(patient.id),
      firstName: String(patient.first_name ?? ""),
      lastName: String(patient.last_name ?? ""),
      documentNumber: String(patient.document_number ?? "").trim(),
      cuil: (patient.cuil as string | null) ?? null,
      sex: (patient.sex as string | null) ?? null,
      birthDate: (patient.birth_date as string | null) ?? null,
      address: (patient.address as string | null) ?? null,
    },
    practitionerForFhir: {
      id: professional.id as string,
      fullName: getProfessionalDisplayName(professional),
      license:
        (professional.license_national as string | null) ||
        (professional.license_provincial as string | null) ||
        (professional.license_number as string | null),
      refepsIdentifier: identity.refepsIdentifier,
    },
    coverage: {
      provider: (patient.insurance_provider as string | null) ?? null,
      number: (patient.insurance_number as string | null) ?? null,
    },
    issuedAt: input.prescription.issued_at,
  });

  if (!prepared.ok) {
    await recordPhase2Audits({
      clinicId: input.clinicId,
      userId: input.userId,
      prescriptionId: input.prescription.id,
      patientId: input.prescription.patient_id,
      events: prepared.auditEvents,
      extra: { code: prepared.code },
    });
    const failed = await updatePrescriptionRefepsState(db, input.prescription.id, input.clinicId, {
      national_rx_status: "failed",
      cuir_status: "pending_official_ids",
    });
    return { ok: false, error: prepared.error, data: failed.ok ? failed.data : undefined };
  }

  await recordPhase2Audits({
    clinicId: input.clinicId,
    userId: input.userId,
    prescriptionId: input.prescription.id,
    patientId: input.prescription.patient_id,
    events: prepared.auditEvents,
    extra: {
      national_rx_status: prepared.nationalRxStatus,
      cuir_status: prepared.cuirStatus,
      // Never log full clinical PHI — only structural readiness tags.
      legal_validity: prepared.cuirStatus === "sandbox" ? "sandbox_only" : "official_pending",
    },
  });

  await updatePrescriptionRefepsState(db, input.prescription.id, input.clinicId, {
    national_rx_status: prepared.nationalRxStatus,
    cuir_status: prepared.cuirStatus,
    cuir_platform_id: prepared.cuirComponents.platformId,
    cuir_repository_id: prepared.cuirComponents.repositoryId,
    cuir_jurisdiction: prepared.cuirComponents.jurisdiction,
    cuir_type_subtype: prepared.cuirComponents.typeSubtype,
    cuir_group_id: prepared.cuirComponents.groupId,
    cuir_item_number: prepared.cuirComponents.itemNumber,
    cuir_formatted: prepared.cuirFormatted,
    prescription_category: prepared.prescriptionCategory,
    prescription_subtype: prepared.prescriptionSubtype,
    diagnosis_coding: prepared.diagnosisCoding as unknown as Record<string, unknown>,
    fhir_bundle_meta: {
      resourceType: prepared.fhirBundle.resourceType,
      entryCount: prepared.fhirBundle.entry.length,
      drflow: prepared.fhirBundle.drflow,
      timestamp: prepared.fhirBundle.timestamp,
    },
  });

  const specialty = professional.specialties as { name?: string } | { name?: string }[] | null;
  const specialtyName = Array.isArray(specialty) ? specialty[0]?.name : specialty?.name;

  const result = await submitPrescriptionToRefepsProvider({
    clinic: {
      id: clinicRow.id,
      name: clinicRow.name,
      establishmentCode: clinicRow.refeps_establishment_code,
    },
    clinicSettings,
    professional: {
      id: professional.id as string,
      fullName: getProfessionalDisplayName(professional),
      licenseNational: professional.license_national as string | null,
      licenseProvincial: professional.license_provincial as string | null,
      licenseNumber: professional.license_number as string | null,
      specialtyName: specialtyName ?? null,
      signatureText: buildProfessionalSignature(professional),
    },
    patient: {
      id: patient.id as string,
      documentNumber: String(patient.document_number ?? "").trim(),
      firstName: String(patient.first_name ?? ""),
      lastName: String(patient.last_name ?? ""),
      insuranceProvider: patient.insurance_provider as string | null,
      insuranceNumber: patient.insurance_number as string | null,
    },
    prescription: input.prescription,
  });

  if (!result.ok) {
    const failed = await updatePrescriptionRefepsState(db, input.prescription.id, input.clinicId, {
      refeps_status: "failed",
      refeps_error: result.error,
      refeps_submitted_at: new Date().toISOString(),
      national_rx_status: "failed",
    });
    if (failed.ok) {
      await insertPrescriptionEvent(db, {
        prescription_id: input.prescription.id,
        clinic_id: input.clinicId,
        event_type: "refeps_failed",
        actor_id: input.userId,
        payload: { error: result.error },
      });
      return { ok: false, error: result.error, data: failed.data };
    }
    return { ok: false, error: result.error };
  }

  const updated = await updatePrescriptionRefepsState(db, input.prescription.id, input.clinicId, {
    refeps_status: "submitted",
    refeps_id: result.refepsId,
    refeps_submitted_at: new Date().toISOString(),
    refeps_error: null,
    refeps_payload: result.payload,
    digital_signature_hash: result.signatureHash,
    national_rx_status: "submitted",
  });

  if (!updated.ok) return { ok: false, error: updated.error };

  await insertPrescriptionEvent(db, {
    prescription_id: input.prescription.id,
    clinic_id: input.clinicId,
    event_type: "refeps_submitted",
    actor_id: input.userId,
    payload: {
      refeps_id: result.refepsId,
      mode: result.mode,
      verification_url: result.verificationUrl ?? null,
      national_rx_status: "submitted",
      cuir_status: prepared.cuirStatus,
    },
  });

  return { ok: true, data: updated.data };
}
