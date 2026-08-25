import "server-only";

import { submitPrescriptionToRefepsProvider } from "@/core/refeps/provider";
import type { RefepsClinicSettings } from "@/core/refeps/types";
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
import type { ElectronicPrescription } from "@/types/prescription";

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
      .select("id, first_name, last_name, document_number, insurance_provider, insurance_number")
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
        event: "prescription_blocked",
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
        event: "prescription_blocked",
        reason: eligibility.issues[0]?.code ?? "refeps_validation_failure",
        channel: "national_electronic",
        refeps_validation_status: eligibility.status,
      },
    });
    return { ok: false, error: eligibility.error };
  }

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
    },
  });

  return { ok: true, data: updated.data };
}
