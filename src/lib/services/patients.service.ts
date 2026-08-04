import type { Patient, UserRole } from "@/types/database";
import type { DbClient } from "@/lib/repositories/types";
import { findClinicInsuranceDefaults } from "@/lib/repositories/clinics.repository";
import {
  extractClinicalProfileFields,
  upsertPatientClinicalProfileRow,
  type PatientClinicalProfileFields,
} from "@/lib/repositories/patient-clinical-profile.repository";
import {
  findPatientById,
  insertPatient,
  updatePatientRow,
  type PatientInsertRow,
  type PatientUpdateRow,
} from "@/lib/repositories/patients.repository";
import type { ServiceResult } from "@/lib/services/types";
import { serviceErr, serviceOk } from "@/lib/services/types";
import type { z } from "zod";
import { patientSchema } from "@/lib/validations/schemas";

type PatientFormData = z.infer<typeof patientSchema>;
export type SanitizedPatient = PatientFormData;

const ADMIN_ONLY_ROLES: UserRole[] = ["secretary"];

export function isAdminOnlyPatientRole(role: UserRole | null, isSuperadmin: boolean): boolean {
  if (isSuperadmin) return false;
  return role != null && ADMIN_ONLY_ROLES.includes(role);
}

function buildPatientInsertRow(
  clinicId: string,
  sanitized: SanitizedPatient,
  insuranceProvider: string | null,
  insurancePlan: string | null
): PatientInsertRow {
  return {
    clinic_id: clinicId,
    first_name: sanitized.first_name,
    last_name: sanitized.last_name,
    document_number: sanitized.document_number,
    birth_date: sanitized.birth_date || null,
    phone: sanitized.phone || null,
    email: sanitized.email || null,
    address: sanitized.address || null,
    insurance_provider: insuranceProvider,
    insurance_plan: insurancePlan,
    insurance_number: sanitized.insurance_number || null,
    emergency_contact_name: sanitized.emergency_contact_name || null,
    emergency_contact_phone: sanitized.emergency_contact_phone || null,
  };
}

function buildAdminUpdateRow(
  sanitized: SanitizedPatient,
  insurancePlan: string | null
): Partial<PatientUpdateRow> {
  return {
    first_name: sanitized.first_name,
    last_name: sanitized.last_name,
    document_number: sanitized.document_number,
    birth_date: sanitized.birth_date || null,
    phone: sanitized.phone || null,
    email: sanitized.email || null,
    address: sanitized.address || null,
    insurance_provider: sanitized.insurance_provider || null,
    insurance_plan: insurancePlan,
    insurance_number: sanitized.insurance_number || null,
    emergency_contact_name: sanitized.emergency_contact_name || null,
    emergency_contact_phone: sanitized.emergency_contact_phone || null,
  };
}

function buildClinicalStaffUpdateRow(
  sanitized: SanitizedPatient,
  insurancePlan: string | null
): Partial<PatientUpdateRow> {
  return {
    first_name: sanitized.first_name,
    last_name: sanitized.last_name,
    document_number: sanitized.document_number,
    phone: sanitized.phone || null,
    email: sanitized.email || null,
    address: sanitized.address || null,
    insurance_provider: sanitized.insurance_provider || null,
    insurance_plan: insurancePlan,
    insurance_number: sanitized.insurance_number || null,
    emergency_contact_name: sanitized.emergency_contact_name || null,
    emergency_contact_phone: sanitized.emergency_contact_phone || null,
    birth_date: sanitized.birth_date || null,
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

  const insertResult = await insertPatient(
    db,
    buildPatientInsertRow(input.clinicId, input.sanitized, insuranceProvider, input.insurancePlan)
  );
  if (!insertResult.ok) return serviceErr(insertResult.error);

  if (!input.adminOnly) {
    const profileResult = await upsertPatientClinicalProfileRow(
      db,
      insertResult.data.id,
      input.clinicId,
      extractClinicalProfileFields(input.sanitized)
    );
    if (!profileResult.ok) return serviceErr(profileResult.error);
  }

  return serviceOk(insertResult.data);
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
  const oldPatient = await findPatientById(db, input.patientId, input.clinicId);
  if (!oldPatient) return serviceErr("Paciente no encontrado");

  const updateRow = input.adminOnly
    ? buildAdminUpdateRow(input.sanitized, input.insurancePlan)
    : buildClinicalStaffUpdateRow(input.sanitized, input.insurancePlan);

  const updateResult = await updatePatientRow(db, input.patientId, input.clinicId, updateRow);
  if (!updateResult.ok) return serviceErr(updateResult.error);

  if (!input.adminOnly) {
    const profileResult = await upsertPatientClinicalProfileRow(
      db,
      input.patientId,
      input.clinicId,
      extractClinicalProfileFields(input.sanitized)
    );
    if (!profileResult.ok) return serviceErr(profileResult.error);
  }

  const updatedPatient = await findPatientById(db, input.patientId, input.clinicId);
  return serviceOk({ oldPatient, updatedPatient });
}

export type { PatientClinicalProfileFields };
