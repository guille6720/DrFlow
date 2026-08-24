import "server-only";

import type { DbClient } from "@/core/repositories/types";

export type OwnershipResult = { ok: true } | { ok: false; error: string };

async function existsInClinic(
  db: DbClient,
  table:
    | "patients"
    | "professionals"
    | "appointments"
    | "locations"
    | "specialties"
    | "clinical_records",
  clinicId: string,
  entityId: string
): Promise<boolean> {
  const { data } = await db
    .from(table)
    .select("id")
    .eq("id", entityId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  return Boolean(data);
}

export async function verifyPatientInClinic(
  db: DbClient,
  clinicId: string,
  patientId: string
): Promise<OwnershipResult> {
  if (!(await existsInClinic(db, "patients", clinicId, patientId))) {
    return { ok: false, error: "Paciente no pertenece al consultorio activo" };
  }
  return { ok: true };
}

export async function verifyProfessionalInClinic(
  db: DbClient,
  clinicId: string,
  professionalId: string
): Promise<OwnershipResult> {
  if (!(await existsInClinic(db, "professionals", clinicId, professionalId))) {
    return { ok: false, error: "Profesional no pertenece al consultorio activo" };
  }
  return { ok: true };
}

export async function verifyAppointmentInClinic(
  db: DbClient,
  clinicId: string,
  appointmentId: string
): Promise<OwnershipResult> {
  if (!(await existsInClinic(db, "appointments", clinicId, appointmentId))) {
    return { ok: false, error: "Turno no pertenece al consultorio activo" };
  }
  return { ok: true };
}

export async function verifyClinicalRecordInClinic(
  db: DbClient,
  clinicId: string,
  recordId: string
): Promise<OwnershipResult> {
  if (!(await existsInClinic(db, "clinical_records", clinicId, recordId))) {
    return { ok: false, error: "Consulta no pertenece al consultorio activo" };
  }
  return { ok: true };
}

export async function verifyLocationInClinic(
  db: DbClient,
  clinicId: string,
  locationId: string
): Promise<OwnershipResult> {
  if (!(await existsInClinic(db, "locations", clinicId, locationId))) {
    return { ok: false, error: "Ubicación no pertenece al consultorio activo" };
  }
  return { ok: true };
}

export async function verifySpecialtyInClinic(
  db: DbClient,
  clinicId: string,
  specialtyId: string
): Promise<OwnershipResult> {
  if (!(await existsInClinic(db, "specialties", clinicId, specialtyId))) {
    return { ok: false, error: "Especialidad no pertenece al consultorio activo" };
  }
  return { ok: true };
}

/** Ensures an optional FK belongs to the active clinic (null/undefined passes). */
export async function verifyOptionalProfessionalInClinic(
  db: DbClient,
  clinicId: string,
  professionalId: string | null | undefined
): Promise<OwnershipResult> {
  if (!professionalId) return { ok: true };
  return verifyProfessionalInClinic(db, clinicId, professionalId);
}

export async function verifyOptionalAppointmentInClinic(
  db: DbClient,
  clinicId: string,
  appointmentId: string | null | undefined
): Promise<OwnershipResult> {
  if (!appointmentId) return { ok: true };
  return verifyAppointmentInClinic(db, clinicId, appointmentId);
}

export async function verifyOptionalClinicalRecordInClinic(
  db: DbClient,
  clinicId: string,
  recordId: string | null | undefined
): Promise<OwnershipResult> {
  if (!recordId) return { ok: true };
  return verifyClinicalRecordInClinic(db, clinicId, recordId);
}

export async function verifyOptionalSpecialtyInClinic(
  db: DbClient,
  clinicId: string,
  specialtyId: string | null | undefined
): Promise<OwnershipResult> {
  if (!specialtyId) return { ok: true };
  return verifySpecialtyInClinic(db, clinicId, specialtyId);
}

export async function verifyOptionalLocationInClinic(
  db: DbClient,
  clinicId: string,
  locationId: string | null | undefined
): Promise<OwnershipResult> {
  if (!locationId) return { ok: true };
  return verifyLocationInClinic(db, clinicId, locationId);
}

export async function verifyAppointmentPatientMatch(
  db: DbClient,
  clinicId: string,
  appointmentId: string,
  patientId: string
): Promise<OwnershipResult> {
  const { data } = await db
    .from("appointments")
    .select("patient_id")
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!data) {
    return { ok: false, error: "Turno no pertenece al consultorio activo" };
  }
  if (data.patient_id !== patientId) {
    return { ok: false, error: "El turno no corresponde al paciente indicado" };
  }
  return { ok: true };
}

function firstOwnershipFailure(...results: OwnershipResult[]): OwnershipResult {
  return results.find((result) => !result.ok) ?? { ok: true };
}

export async function verifyClinicalRecordForeignKeys(
  db: DbClient,
  clinicId: string,
  keys: {
    patientId: string;
    professionalId: string;
    appointmentId?: string | null;
  }
): Promise<OwnershipResult> {
  const [patient, professional, appointment] = await Promise.all([
    verifyPatientInClinic(db, clinicId, keys.patientId),
    verifyProfessionalInClinic(db, clinicId, keys.professionalId),
    keys.appointmentId
      ? verifyAppointmentPatientMatch(db, clinicId, keys.appointmentId, keys.patientId)
      : Promise.resolve({ ok: true as const }),
  ]);
  return firstOwnershipFailure(patient, professional, appointment);
}

export async function verifyAppointmentForeignKeys(
  db: DbClient,
  clinicId: string,
  keys: {
    patientId: string;
    professionalId: string;
    locationId?: string | null;
    specialtyId?: string | null;
  }
): Promise<OwnershipResult> {
  const [patient, professional, location, specialty] = await Promise.all([
    verifyPatientInClinic(db, clinicId, keys.patientId),
    verifyProfessionalInClinic(db, clinicId, keys.professionalId),
    verifyOptionalLocationInClinic(db, clinicId, keys.locationId),
    verifyOptionalSpecialtyInClinic(db, clinicId, keys.specialtyId),
  ]);
  return firstOwnershipFailure(patient, professional, location, specialty);
}

export async function verifyCashChargeForeignKeys(
  db: DbClient,
  clinicId: string,
  keys: {
    patientId: string;
    professionalId?: string | null;
    appointmentId?: string | null;
  }
): Promise<OwnershipResult> {
  const [patient, professional, appointment] = await Promise.all([
    verifyPatientInClinic(db, clinicId, keys.patientId),
    verifyOptionalProfessionalInClinic(db, clinicId, keys.professionalId),
    keys.appointmentId
      ? verifyAppointmentPatientMatch(db, clinicId, keys.appointmentId, keys.patientId)
      : Promise.resolve({ ok: true as const }),
  ]);
  return firstOwnershipFailure(patient, professional, appointment);
}

export async function verifyPrescriptionForeignKeys(
  db: DbClient,
  clinicId: string,
  keys: {
    patientId: string;
    professionalId: string;
    clinicalRecordId?: string | null;
  }
): Promise<OwnershipResult> {
  const [patient, professional, record] = await Promise.all([
    verifyPatientInClinic(db, clinicId, keys.patientId),
    verifyProfessionalInClinic(db, clinicId, keys.professionalId),
    verifyOptionalClinicalRecordInClinic(db, clinicId, keys.clinicalRecordId),
  ]);
  return firstOwnershipFailure(patient, professional, record);
}

export async function verifyMedicalOrderForeignKeys(
  db: DbClient,
  clinicId: string,
  keys: {
    patientId: string;
    professionalId: string;
    clinicalRecordId?: string | null;
  }
): Promise<OwnershipResult> {
  return verifyPrescriptionForeignKeys(db, clinicId, keys);
}

export async function verifyPaymentForeignKeys(
  db: DbClient,
  clinicId: string,
  keys: {
    patientId: string;
    appointmentId?: string | null;
  }
): Promise<OwnershipResult> {
  const [patient, appointment] = await Promise.all([
    verifyPatientInClinic(db, clinicId, keys.patientId),
    keys.appointmentId
      ? verifyAppointmentPatientMatch(db, clinicId, keys.appointmentId, keys.patientId)
      : Promise.resolve({ ok: true as const }),
  ]);
  return firstOwnershipFailure(patient, appointment);
}
