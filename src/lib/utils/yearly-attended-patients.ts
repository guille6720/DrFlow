import { formatAgeLabel } from "@/features/pacientes/utils/patient-age";

export type YearlyAttendedPatient = {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  insurance_provider: string | null;
  lastAttentionAt: string;
  attentionCount: number;
  ageLabel: string | null;
};

type PatientEmbed = {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  insurance_provider: string | null;
};

function resolvePatient(
  patientId: string,
  embed: PatientEmbed | PatientEmbed[] | null | undefined
): PatientEmbed | null {
  if (!embed) return null;
  const row = Array.isArray(embed) ? embed[0] : embed;
  return row?.id ? row : null;
}

/** Pacientes únicos con atención (turno atendido o consulta) en los últimos 12 meses. */
export function buildYearlyAttendedPatients(
  appointments: Array<{ patient_id: string; start_at: string; patients?: PatientEmbed | PatientEmbed[] | null }>,
  clinicalRecords: Array<{ patient_id: string; created_at: string; patients?: PatientEmbed | PatientEmbed[] | null }>
): YearlyAttendedPatient[] {
  const map = new Map<
    string,
    {
      patient: PatientEmbed;
      lastAttentionAt: string;
      attentionCount: number;
    }
  >();

  for (const row of appointments) {
    const patient = resolvePatient(row.patient_id, row.patients);
    if (!patient) continue;
    const existing = map.get(row.patient_id);
    if (!existing) {
      map.set(row.patient_id, {
        patient,
        lastAttentionAt: row.start_at,
        attentionCount: 1,
      });
      continue;
    }
    existing.attentionCount += 1;
    if (row.start_at > existing.lastAttentionAt) {
      existing.lastAttentionAt = row.start_at;
    }
  }

  for (const row of clinicalRecords) {
    const patient = resolvePatient(row.patient_id, row.patients);
    if (!patient) continue;
    const existing = map.get(row.patient_id);
    if (!existing) {
      map.set(row.patient_id, {
        patient,
        lastAttentionAt: row.created_at,
        attentionCount: 1,
      });
      continue;
    }
    existing.attentionCount += 1;
    if (row.created_at > existing.lastAttentionAt) {
      existing.lastAttentionAt = row.created_at;
    }
  }

  return [...map.values()]
    .map(({ patient, lastAttentionAt, attentionCount }) => ({
      id: patient.id,
      first_name: patient.first_name,
      last_name: patient.last_name,
      document_number: patient.document_number,
      birth_date: patient.birth_date,
      phone: patient.phone,
      email: patient.email,
      insurance_provider: patient.insurance_provider,
      lastAttentionAt,
      attentionCount,
      ageLabel: formatAgeLabel(patient.birth_date),
    }))
    .sort((a, b) => b.lastAttentionAt.localeCompare(a.lastAttentionAt));
}
