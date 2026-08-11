"use server";

import { getActiveClinic, getActiveClinicId, getSession } from "@/core/auth/session.server";
import { hasPermission } from "@/core/permissions/roles";
import {
  encodeDescCursor,
  parseDescCursor,
  PATIENT_EHR_RECORD_PAGE_SIZE,
} from "@/core/supabase/pagination";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

import {
  mapClinicalRecordsForEhr,
  type PatientEhrMappedRecord,
} from "@/features/pacientes/server/load-patient-ehr-data";
import { buildEhrPayloadFromRecords } from "@/features/pacientes/utils/patient-ehr-model";

export type LoadMorePatientClinicalRecordsResult = {
  consultations?: ReturnType<typeof buildEhrPayloadFromRecords>["consultations"];
  diagnosisRows?: ReturnType<typeof buildEhrPayloadFromRecords>["diagnosisRows"];
  treatmentRows?: ReturnType<typeof buildEhrPayloadFromRecords>["treatmentRows"];
  nextCursor?: string | null;
  hasMore?: boolean;
  error?: string;
};

export async function loadMorePatientClinicalRecords(
  patientId: string,
  cursor?: string
): Promise<LoadMorePatientClinicalRecordsResult> {
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
  const parsedCursor = parseDescCursor(cursor);

  const { data: patient } = await supabase
    .from("patients")
    .select("id")
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!patient) return { error: "Paciente no encontrado" };

  let query = supabase
    .from("clinical_records")
    .select(
      "id, created_at, chief_complaint, diagnosis, evolution, indications, professional_id, professional_signature, professionals(license_national, license_provincial, profiles(full_name, email))"
    )
    .eq("clinic_id", clinicId)
    .eq("patient_id", idParsed.data)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PATIENT_EHR_RECORD_PAGE_SIZE + 1);

  if (parsedCursor) {
    query = query.lt("created_at", parsedCursor.sortValue);
  }

  const { data: records, error } = await query;
  if (error) return { error: "No se pudieron cargar más consultas" };

  const rows = (records ?? []) as Array<
    PatientEhrMappedRecord & {
      professionals: unknown;
    }
  >;
  const hasMore = rows.length > PATIENT_EHR_RECORD_PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, PATIENT_EHR_RECORD_PAGE_SIZE) : rows;
  const mappedRecords = mapClinicalRecordsForEhr(pageRows);
  const payload = buildEhrPayloadFromRecords(mappedRecords);
  const last = pageRows.at(-1);

  return {
    consultations: payload.consultations,
    diagnosisRows: payload.diagnosisRows,
    treatmentRows: payload.treatmentRows,
    nextCursor: hasMore && last ? encodeDescCursor(last.created_at, last.id) : null,
    hasMore,
  };
}
