export type PatientNameRef = {
  first_name: string;
  last_name: string;
};

export type PatientDocumentRef = PatientNameRef & {
  document_number?: string | null;
};

/** Unwrap PostgREST nested patient relation (object or single-element array). */
export function resolveAppointmentPatient<T extends PatientDocumentRef>(
  patients?: T | T[] | null
): T | null {
  if (!patients) return null;
  return Array.isArray(patients) ? (patients[0] ?? null) : patients;
}

/** Format joined patient name from PostgREST relation (object or array). */
export function formatPatientName(
  patients?: PatientNameRef | PatientNameRef[] | null,
  fallback = "Paciente"
): string {
  const patient = resolveAppointmentPatient(patients);
  return patient ? `${patient.last_name}, ${patient.first_name}` : fallback;
}

/** DNI/document label for agenda and lists. */
export function formatPatientDocument(documentNumber?: string | null): string | null {
  const trimmed = documentNumber?.trim();
  return trimmed ? trimmed : null;
}
