export type InformedConsentRecord = {
  id: string;
  clinicalRecordId: string;
  patientId: string;
  appointmentId: string | null;
  granted: boolean;
  grantedAt: string | null;
  documentVersion: string | null;
  procedureDescription: string | null;
  signatureName: string | null;
  notes: string | null;
  recordedByName: string | null;
  createdAt: string;
};

export function mapInformedConsentRow(row: {
  id: string;
  clinical_record_id: string | null;
  patient_id: string | null;
  appointment_id: string | null;
  granted: boolean;
  granted_at: string | null;
  document_version: string | null;
  procedure_description: string | null;
  signature_name: string | null;
  notes: string | null;
  created_at: string;
  profiles?: { full_name: string } | { full_name: string }[] | null;
}): InformedConsentRecord | null {
  if (!row.clinical_record_id || !row.patient_id) return null;
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    id: row.id,
    clinicalRecordId: row.clinical_record_id,
    patientId: row.patient_id,
    appointmentId: row.appointment_id,
    granted: row.granted,
    grantedAt: row.granted_at,
    documentVersion: row.document_version,
    procedureDescription: row.procedure_description,
    signatureName: row.signature_name,
    notes: row.notes,
    recordedByName: profile?.full_name ?? null,
    createdAt: row.created_at,
  };
}
