"use server";

import { getActiveClinic, getActiveClinicId, getSession } from "@/core/auth/session.server";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

import {
  attachStructuredChildrenToRecords,
  loadClinicalRecordChildrenForPatient,
} from "@/features/pacientes/server/load-clinical-structure";
import {
  fetchPatientClinicalRecordsForEhr,
  mapClinicalRecordsForEhr,
  PATIENT_EHR_PRINT_MAX_RECORDS,
} from "@/features/pacientes/server/load-patient-ehr-data";
import { buildEhrPayloadFromRecords } from "@/features/pacientes/utils/patient-ehr-model";

export type LoadPatientClinicalRecordsForPrintResult = {
  consultations?: ReturnType<typeof buildEhrPayloadFromRecords>["consultations"];
  diagnosisRows?: ReturnType<typeof buildEhrPayloadFromRecords>["diagnosisRows"];
  treatmentRows?: ReturnType<typeof buildEhrPayloadFromRecords>["treatmentRows"];
  truncated?: boolean;
  error?: string;
};

/**
 * Full clinical history for "Imprimir historia clínica".
 * UI still first-paints with PATIENT_EHR_INITIAL_LIMIT; print loads up to the print cap.
 */
export async function loadPatientClinicalRecordsForPrint(
  patientId: string
): Promise<LoadPatientClinicalRecordsForPrintResult> {
  const user = await getSession();
  if (!user) return { error: "Sin sesión" };

  const clinicId = await getActiveClinicId();
  if (!clinicId) return { error: "Sin clínica activa" };

  const { role, isSuperadmin } = await getActiveClinic();
  if (!hasPermission(role, "viewClinicalRecords", isSuperadmin)) {
    return { error: "Sin permisos para ver historias clínicas" };
  }

  const idParsed = parseEntityId(patientId, "Paciente");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("id")
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!patient) return { error: "Paciente no encontrado" };

  const { data: records, count, error } = await fetchPatientClinicalRecordsForEhr(
    supabase,
    clinicId,
    idParsed.data,
    { limit: PATIENT_EHR_PRINT_MAX_RECORDS, withCount: true }
  );

  if (error) return { error: "No se pudo cargar la historia clínica para imprimir" };

  const rows = records ?? [];
  const mappedBase = mapClinicalRecordsForEhr(rows);
  const { diagnosesByRecord, treatmentsByRecord } = await loadClinicalRecordChildrenForPatient(
    supabase,
    clinicId,
    idParsed.data,
    mappedBase.map((r) => r.id)
  );
  const mappedRecords = attachStructuredChildrenToRecords(
    mappedBase,
    diagnosesByRecord,
    treatmentsByRecord
  );
  const payload = buildEhrPayloadFromRecords(mappedRecords, { includeHceStructural: true });
  const total = count ?? rows.length;
  const truncated = total > rows.length;

  return {
    consultations: payload.consultations,
    diagnosisRows: payload.diagnosisRows,
    treatmentRows: payload.treatmentRows,
    truncated,
  };
}
