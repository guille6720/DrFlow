import type { SupabaseClient } from "@supabase/supabase-js";

import type { RefepsValidationStatus } from "@/core/renapdis/types";
import { isRefepsValidationStatus } from "@/core/renapdis/types";

import type { ProfessionalListItem } from "@/features/profesionales/components/profesionales/professional-intake-sidebar";
import type {
  AvailabilityRuleRow,
  ProfessionalIntakeDetail,
} from "@/features/profesionales/components/profesionales/professional-intake-types";

const PROFESSIONAL_DETAIL_COLUMNS =
  "id, display_name, document_number, email, phone, license_national, license_provincial, license_number, office_phone, office_address, accepted_insurances, intake_notes, intake_completed_at, location_id, tax_id, cuil, licensing_jurisdiction, issuing_authority, refeps_identifier, refeps_specialty, refeps_validation_status, refeps_validated_at, refeps_validation_error, iva_status, bank_name, bank_account_type, bank_account_number, bank_cbu, bank_alias, specialties(name)";

function mapSpecialty(row: Record<string, unknown>) {
  const spec = row.specialties;
  if (spec && typeof spec === "object" && !Array.isArray(spec) && "name" in spec) {
    return { name: String((spec as { name: string }).name) };
  }
  if (Array.isArray(spec) && spec[0] && typeof spec[0] === "object" && "name" in spec[0]) {
    return { name: String((spec[0] as { name: string }).name) };
  }
  return null;
}

function mapProfessionalDetail(row: Record<string, unknown>): ProfessionalIntakeDetail {
  const statusRaw = row.refeps_validation_status;
  const refepsStatus: RefepsValidationStatus = isRefepsValidationStatus(statusRaw)
    ? statusRaw
    : "not_configured";

  return {
    id: String(row.id),
    display_name: (row.display_name as string | null) ?? null,
    document_number: row.document_number as string | null | undefined,
    email: row.email as string | null | undefined,
    phone: row.phone as string | null | undefined,
    license_national: row.license_national as string | null | undefined,
    license_provincial: row.license_provincial as string | null | undefined,
    license_number: row.license_number as string | null | undefined,
    office_phone: row.office_phone as string | null | undefined,
    office_address: row.office_address as string | null | undefined,
    accepted_insurances: row.accepted_insurances as string | null | undefined,
    intake_notes: row.intake_notes as string | null | undefined,
    intake_completed_at: row.intake_completed_at as string | null | undefined,
    location_id: row.location_id as string | null | undefined,
    tax_id: row.tax_id as string | null | undefined,
    cuil: row.cuil as string | null | undefined,
    licensing_jurisdiction: row.licensing_jurisdiction as string | null | undefined,
    issuing_authority: row.issuing_authority as string | null | undefined,
    refeps_identifier: row.refeps_identifier as string | null | undefined,
    refeps_specialty: row.refeps_specialty as string | null | undefined,
    refeps_validation_status: refepsStatus,
    refeps_validated_at: row.refeps_validated_at as string | null | undefined,
    refeps_validation_error: row.refeps_validation_error as string | null | undefined,
    iva_status: row.iva_status as string | null | undefined,
    bank_name: row.bank_name as string | null | undefined,
    bank_account_type: row.bank_account_type as string | null | undefined,
    bank_account_number: row.bank_account_number as string | null | undefined,
    bank_cbu: row.bank_cbu as string | null | undefined,
    bank_alias: row.bank_alias as string | null | undefined,
    specialties: mapSpecialty(row),
  };
}

/** Lightweight roster for the sidebar — no bank/tax columns. */
export async function loadProfessionalIntakeSidebar(
  supabase: SupabaseClient,
  clinicId: string
): Promise<ProfessionalListItem[]> {
  const { data } = await supabase
    .from("professionals")
    .select("id, display_name, intake_completed_at, specialties(name)")
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .order("display_name");

  return (data ?? []).map((row) => {
    const mapped = row as Record<string, unknown>;
    return {
      id: String(mapped.id),
      display_name: (mapped.display_name as string | null) ?? null,
      intake_completed_at: mapped.intake_completed_at as string | null | undefined,
      specialties: mapSpecialty(mapped),
    };
  });
}

/** Full professional profile + schedule rules for the selected row only. */
export async function loadProfessionalIntakeDetail(
  supabase: SupabaseClient,
  clinicId: string,
  professionalId: string
): Promise<{ professional: ProfessionalIntakeDetail | null; rules: AvailabilityRuleRow[] }> {
  const [{ data: professional }, { data: rules }] = await Promise.all([
    supabase
      .from("professionals")
      .select(PROFESSIONAL_DETAIL_COLUMNS)
      .eq("clinic_id", clinicId)
      .eq("id", professionalId)
      .maybeSingle(),
    supabase
      .from("availability_rules")
      .select("id, professional_id, day_of_week, start_time, end_time, slot_duration")
      .eq("clinic_id", clinicId)
      .eq("professional_id", professionalId)
      .eq("is_active", true),
  ]);

  return {
    professional: professional ? mapProfessionalDetail(professional as Record<string, unknown>) : null,
    rules: (rules ?? []) as AvailabilityRuleRow[],
  };
}
