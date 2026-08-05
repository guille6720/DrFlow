export type PatientNameRef = {
  first_name: string;
  last_name: string;
};

/** Format joined patient name from PostgREST relation (object or array). */
export function formatPatientName(
  patients?: PatientNameRef | PatientNameRef[] | null,
  fallback = "Paciente"
): string {
  if (!patients) return fallback;
  const p = Array.isArray(patients) ? patients[0] : patients;
  return p ? `${p.last_name}, ${p.first_name}` : fallback;
}
