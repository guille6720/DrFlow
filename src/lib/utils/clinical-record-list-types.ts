/** Fila de consulta con joins usada en listados de historias. */
export type ClinicalRecordListRow = {
  id: string;
  patient_id: string;
  diagnosis: string | null;
  chief_complaint: string | null;
  created_at: string;
  patients: {
    first_name: string;
    last_name: string;
    phone: string | null;
    document_number: string;
  } | null;
  professionals: { profiles: { full_name: string } | null } | null;
};
