import type { z } from "zod";

import { resolvePostgresUserMessage } from "@/core/errors/postgres-error";
import type { DbClient } from "@/core/repositories/types";
import type { ServiceResult } from "@/core/services/types";
import { serviceErr, serviceOk } from "@/core/services/types";
import { patientSchema } from "@/core/validations/schemas";

import { findClinicInsuranceDefaults } from "@/features/configuracion/repositories/clinics.repository";
import {
  extractClinicalProfileFields,
  type PatientClinicalProfileFields,
} from "@/features/pacientes/repositories/patient-clinical-profile.repository";

import type { Patient, UserRole } from "@/types/database";

type PatientFormData = z.infer<typeof patientSchema>;
export type SanitizedPatient = PatientFormData;

const ADMIN_ONLY_ROLES: UserRole[] = ["secretary"];

export function isAdminOnlyPatientRole(role: UserRole | null, isSuperadmin: boolean): boolean {
  if (isSuperadmin) return false;
  return role != null && ADMIN_ONLY_ROLES.includes(role);
}

function buildPatientPayload(
  sanitized: SanitizedPatient,
  insuranceProvider: string | null,
  insurancePlan: string | null
) {
  return {
    first_name: sanitized.first_name,
    last_name: sanitized.last_name,
    document_number: sanitized.document_number,
    birth_date: sanitized.birth_date || "",
    phone: sanitized.phone || "",
    email: sanitized.email || "",
    address: sanitized.address || "",
    insurance_provider: insuranceProvider || "",
    insurance_plan: insurancePlan || "",
    insurance_number: sanitized.insurance_number || "",
    emergency_contact_name: sanitized.emergency_contact_name || "",
    emergency_contact_phone: sanitized.emergency_contact_phone || "",
  };
}

function buildAdminUpdatePayload(
  sanitized: SanitizedPatient,
  insurancePlan: string | null
) {
  return {
    first_name: sanitized.first_name,
    last_name: sanitized.last_name,
    document_number: sanitized.document_number,
    birth_date: sanitized.birth_date || "",
    phone: sanitized.phone || "",
    email: sanitized.email || "",
    address: sanitized.address || "",
    insurance_provider: sanitized.insurance_provider || "",
    insurance_plan: insurancePlan || "",
    insurance_number: sanitized.insurance_number || "",
    emergency_contact_name: sanitized.emergency_contact_name || "",
    emergency_contact_phone: sanitized.emergency_contact_phone || "",
  };
}

function buildClinicalStaffUpdatePayload(
  sanitized: SanitizedPatient,
  insurancePlan: string | null
) {
  return {
    first_name: sanitized.first_name,
    last_name: sanitized.last_name,
    document_number: sanitized.document_number,
    phone: sanitized.phone || "",
    email: sanitized.email || "",
    address: sanitized.address || "",
    insurance_provider: sanitized.insurance_provider || "",
    insurance_plan: insurancePlan || "",
    insurance_number: sanitized.insurance_number || "",
    emergency_contact_name: sanitized.emergency_contact_name || "",
    emergency_contact_phone: sanitized.emergency_contact_phone || "",
    birth_date: sanitized.birth_date || "",
  };
}

export async function createPatientRecord(
  db: DbClient,
  input: {
    clinicId: string;
    adminOnly: boolean;
    sanitized: SanitizedPatient;
    insurancePlan: string | null;
  }
): Promise<ServiceResult<Patient>> {
  const clinic = await findClinicInsuranceDefaults(db, input.clinicId);
  const insuranceProvider =
    input.sanitized.insurance_provider?.trim() ||
    clinic?.default_insurance_provider ||
    null;

  const { data, error } = await db.rpc("create_patient_with_clinical_profile", {
    p_clinic_id: input.clinicId,
    p_patient: buildPatientPayload(input.sanitized, insuranceProvider, input.insurancePlan),
    p_profile: input.adminOnly ? null : extractClinicalProfileFields(input.sanitized),
  });

  if (error) return serviceErr(error.message);
  return serviceOk(data as Patient);
}

export async function updatePatientRecord(
  db: DbClient,
  input: {
    patientId: string;
    clinicId: string;
    adminOnly: boolean;
    sanitized: SanitizedPatient;
    insurancePlan: string | null;
  }
): Promise<ServiceResult<{ oldPatient: Patient; updatedPatient: Patient | null }>> {
  const payload = input.adminOnly
    ? buildAdminUpdatePayload(input.sanitized, input.insurancePlan)
    : buildClinicalStaffUpdatePayload(input.sanitized, input.insurancePlan);

  const { data, error } = await db.rpc("update_patient_with_clinical_profile", {
    p_clinic_id: input.clinicId,
    p_patient_id: input.patientId,
    p_patient: payload,
    p_profile: input.adminOnly ? null : extractClinicalProfileFields(input.sanitized),
  });

  if (error) {
    return serviceErr(resolvePostgresUserMessage(error, { fallback: error.message }));
  }

  const result = data as { old: Patient; data: Patient };
  return serviceOk({ oldPatient: result.old, updatedPatient: result.data });
}

export type { PatientClinicalProfileFields };
