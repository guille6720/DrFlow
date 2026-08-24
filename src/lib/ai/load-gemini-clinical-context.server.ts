import "server-only";

import { createClient } from "@/core/supabase/server";

import {
  ageYearsFromBirthDate,
} from "@/lib/ai/anonymize-clinical-context";
import { sanitizeClinicalContextBlock } from "@/lib/ai/external-clinical-ai-gateway.server";
import type { GeminiClinicalContext } from "@/lib/ai/gemini-clinical-context";
import { buildPatientKnownIdentifiers } from "@/lib/ai/patient-ai-identifiers.server";

export type { GeminiClinicalContext, GeminiClinicalRecord } from "@/lib/ai/gemini-clinical-context";
export { formatGeminiClinicalContext } from "@/lib/ai/gemini-clinical-context";

function clean(value: string | null | undefined, identifiers: string[]): string {
  return sanitizeClinicalContextBlock(value ?? "", identifiers);
}

/** Load clinic-scoped clinical history and strip identifiers before LLM use. */
export async function loadGeminiClinicalContext(
  clinicId: string,
  patientId: string
): Promise<GeminiClinicalContext | null> {
  const supabase = await createClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("id, first_name, last_name, document_number, phone, email, birth_date, insurance_provider")
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!patient) return null;

  const identifiers = buildPatientKnownIdentifiers({
    firstName: patient.first_name,
    lastName: patient.last_name,
    documentNumber: patient.document_number,
    phone: patient.phone,
    email: patient.email,
  });

  const { data: records } = await supabase
    .from("clinical_records")
    .select("created_at, chief_complaint, diagnosis, evolution, indications")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(8);

  return {
    patientToken: "PACIENTE_A",
    ageYears: ageYearsFromBirthDate(patient.birth_date),
    insuranceProvider: patient.insurance_provider?.trim() || null,
    records: (records ?? []).map((row) => ({
      date: String(row.created_at).slice(0, 10),
      chiefComplaint: clean(row.chief_complaint, identifiers),
      diagnosis: clean(row.diagnosis, identifiers),
      evolution: clean(row.evolution, identifiers),
      indications: clean(row.indications, identifiers),
    })),
  };
}
