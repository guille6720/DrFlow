import type { PatientSearchOption } from "@/features/pacientes/components/pacientes/patient-search-combobox";

type ApiPatient = PatientSearchOption & {
  label?: string;
  description?: string;
};

/** Normalizes command-palette hits and picker rows into combobox options. */
export function normalizePatientSearchResult(raw: ApiPatient): PatientSearchOption {
  if (raw.first_name && raw.last_name) {
    return {
      id: raw.id,
      first_name: raw.first_name,
      last_name: raw.last_name,
      document_number: raw.document_number,
      birth_date: raw.birth_date,
      phone: raw.phone,
      insurance_provider: raw.insurance_provider,
    };
  }

  if (raw.label) {
    const [last_name, ...rest] = raw.label.split(",").map((part) => part.trim());
    const document_number = (raw.description ?? "").replace(/^DNI\s*/i, "").trim();
    return {
      id: raw.id,
      first_name: rest.join(", "),
      last_name,
      document_number,
      phone: raw.phone,
      birth_date: raw.birth_date,
      insurance_provider: raw.insurance_provider,
    };
  }

  return {
    id: raw.id,
    first_name: raw.first_name ?? "",
    last_name: raw.last_name ?? "",
    document_number: raw.document_number ?? "",
    birth_date: raw.birth_date,
    phone: raw.phone,
    insurance_provider: raw.insurance_provider,
  };
}
