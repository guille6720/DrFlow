import { NextResponse } from "next/server";
import { getActiveClinic, getActiveClinicId } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions/roles";
import { applyPatientSearchFilter, sanitizePatientSearchTerm } from "@/lib/utils/patient-search";
import { mapPatientHits } from "@/lib/utils/command-palette-search";

export async function GET(request: Request) {
  const q = sanitizePatientSearchTerm(new URL(request.url).searchParams.get("q") ?? "");
  if (q.length < 2) {
    return NextResponse.json({ patients: [] });
  }

  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!clinicId) {
    return NextResponse.json({ patients: [] });
  }

  const canSearch =
    hasPermission(role, "managePatients", isSuperadmin) ||
    hasPermission(role, "viewClinicalRecords", isSuperadmin);
  if (!canSearch) {
    return NextResponse.json({ patients: [] }, { status: 403 });
  }

  const supabase = await createClient();
  let query = supabase
    .from("patients")
    .select("id, first_name, last_name, document_number")
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .order("last_name")
    .limit(12);

  query = applyPatientSearchFilter(query, q);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ patients: [], error: error.message }, { status: 500 });
  }

  return NextResponse.json({ patients: mapPatientHits(data ?? []) });
}
