import "server-only";

import { createClient } from "@/core/supabase/server";

/** Build a deduplicated list of patient identifiers for AI redaction. */
export function buildPatientKnownIdentifiers(input: {
  firstName?: string | null;
  lastName?: string | null;
  documentNumber?: string | null;
  phone?: string | null;
  email?: string | null;
}): string[] {
  const first = input.firstName?.trim() ?? "";
  const last = input.lastName?.trim() ?? "";
  const candidates = [
    first,
    last,
    `${last}, ${first}`,
    `${first} ${last}`,
    input.documentNumber?.trim(),
    input.phone?.trim(),
    input.email?.trim(),
  ];
  return [...new Set(candidates.filter((v): v is string => Boolean(v && v.length >= 2)))];
}

/** Load known identifiers for a clinic-scoped patient (server-side). */
export async function loadPatientKnownIdentifiers(
  clinicId: string,
  patientId: string
): Promise<string[]> {
  const supabase = await createClient();
  const { data: patient } = await supabase
    .from("patients")
    .select("first_name, last_name, document_number, phone, email")
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!patient) return [];

  return buildPatientKnownIdentifiers({
    firstName: patient.first_name,
    lastName: patient.last_name,
    documentNumber: patient.document_number,
    phone: patient.phone,
    email: patient.email,
  });
}
