import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { type FhirImportDraft, parseFhirImportDraft, parseFhirJson } from "@/core/services/interoperability/fhir";

import {
  detectPatientDuplicates,
  type PatientDuplicateCandidate,
} from "@/features/integraciones/lib/patient-import-duplicates";

import {
  FHIR_IMPORT_MAX_ENCOUNTERS,
  FHIR_IMPORT_MAX_PATIENTS,
  FHIR_IMPORT_MAX_RESOURCES,
} from "@/lib/constants/clinical-documents";

export type PreparedFhirImport = {
  draft: FhirImportDraft;
  duplicates: PatientDuplicateCandidate[];
  stats: {
    patients: number;
    encounters: number;
    resources: number;
    duplicates: number;
    invalid: number;
  };
};

export function prepareFhirImportFromText(
  raw: string
): { ok: true; prepared: Omit<PreparedFhirImport, "duplicates"> } | { ok: false; error: string } {
  const parsed = parseFhirJson(raw);
  if (!parsed.ok) return parsed;
  const draft = parseFhirImportDraft(parsed.bundle);
  const resources = Object.values(draft.resourceCounts).reduce((sum, count) => sum + count, 0);
  const encounters = draft.patients.reduce((sum, item) => sum + item.encounters.length, 0);

  if (resources > FHIR_IMPORT_MAX_RESOURCES) {
    return { ok: false, error: `El Bundle supera ${FHIR_IMPORT_MAX_RESOURCES} recursos.` };
  }
  if (draft.patients.length > FHIR_IMPORT_MAX_PATIENTS) {
    return { ok: false, error: `Máximo ${FHIR_IMPORT_MAX_PATIENTS} pacientes por importación FHIR.` };
  }
  if (encounters > FHIR_IMPORT_MAX_ENCOUNTERS) {
    return { ok: false, error: `Máximo ${FHIR_IMPORT_MAX_ENCOUNTERS} encuentros por importación FHIR.` };
  }
  if (draft.patients.length === 0) {
    return { ok: false, error: draft.issues[0] ?? "El Bundle no tiene pacientes con DNI, apellido y nombre." };
  }

  return {
    ok: true,
    prepared: {
      draft,
      stats: {
        patients: draft.patients.length,
        encounters,
        resources,
        duplicates: 0,
        invalid: draft.issues.length,
      },
    },
  };
}

export async function attachFhirDuplicates(
  supabase: SupabaseClient,
  clinicId: string,
  prepared: Omit<PreparedFhirImport, "duplicates">
): Promise<PreparedFhirImport> {
  const documents = prepared.draft.patients
    .map((item) => item.demographics.document_number)
    .filter((value): value is string => Boolean(value));
  const lastNames = [...new Set(prepared.draft.patients.map((item) => item.demographics.last_name))];

  const found = new Map<
    string,
    {
      id: string;
      first_name: string;
      last_name: string;
      document_number: string;
      birth_date: string | null;
      phone: string | null;
      email: string | null;
      insurance_provider: string | null;
      insurance_plan: string | null;
    }
  >();

  if (documents.length) {
    const { data } = await supabase
      .from("patients")
      .select("id, first_name, last_name, document_number, birth_date, phone, email, insurance_provider, insurance_plan")
      .eq("clinic_id", clinicId)
      .in("document_number", documents);
    for (const row of data ?? []) found.set(row.id, row);
  }
  if (lastNames.length) {
    const { data } = await supabase
      .from("patients")
      .select("id, first_name, last_name, document_number, birth_date, phone, email, insurance_provider, insurance_plan")
      .eq("clinic_id", clinicId)
      .in("last_name", lastNames)
      .limit(2000);
    for (const row of data ?? []) found.set(row.id, row);
  }

  const duplicates = detectPatientDuplicates(
    prepared.draft.patients.map((item) => item.demographics),
    [...found.values()]
  );

  return {
    ...prepared,
    duplicates,
    stats: { ...prepared.stats, duplicates: duplicates.length },
  };
}
