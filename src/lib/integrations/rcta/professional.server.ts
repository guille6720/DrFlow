import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProfessionalPayload } from "@/lib/integrations/rcta/types";

/**
 * Prepared for the future official RCTA API: reads (never writes) the professional data a prescription
 * repository usually needs. Always scoped by the server-validated clinic. Not sent anywhere in phase 1.
 */
export async function loadRctaProfessionalPayload(
  db: SupabaseClient,
  clinicId: string,
  professionalId: string
): Promise<ProfessionalPayload | null> {
  const { data } = await db
    .from("professionals")
    .select(
      "id, display_name, license_number, license_national, license_provincial, licensing_jurisdiction, refeps_identifier, profiles(full_name), specialties(name)"
    )
    .eq("id", professionalId)
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (!data) return null;
  return mapRctaProfessionalPayload(data as RctaProfessionalRow);
}

export type RctaProfessionalRow = {
  id: string;
  display_name: string | null;
  license_number: string | null;
  license_national: string | null;
  license_provincial: string | null;
  licensing_jurisdiction: string | null;
  refeps_identifier: string | null;
  profiles: { full_name: string | null } | { full_name: string | null }[] | null;
  specialties: { name: string | null } | { name: string | null }[] | null;
};

function first<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export function mapRctaProfessionalPayload(row: RctaProfessionalRow): ProfessionalPayload {
  const national = row.license_national?.trim() || null;
  const provincial = row.license_provincial?.trim() || null;
  return {
    professionalId: row.id,
    fullName: first(row.profiles)?.full_name?.trim() || row.display_name?.trim() || null,
    licenseNumber: national ?? provincial ?? (row.license_number?.trim() || null),
    licenseJurisdiction: national ? "nacional" : row.licensing_jurisdiction?.trim() || null,
    specialty: first(row.specialties)?.name?.trim() || null,
    externalIdentifier: row.refeps_identifier?.trim() || null,
  };
}
