import { NextResponse } from "next/server";

import { getActiveClinic, getActiveClinicId, getSession } from "@/core/auth/session";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";
import { searchQuerySchema } from "@/core/validations/params";

import { applyPatientSearchFilter } from "@/features/pacientes/utils/patient-search";

import { mapPatientHits } from "@/lib/utils/command-palette-search";

export async function GET(request: Request) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const qParsed = searchQuerySchema.safeParse(
    new URL(request.url).searchParams.get("q")?.trim() ?? ""
  );
  if (!qParsed.success) {
    return NextResponse.json({ patients: [] });
  }
  const q = qParsed.data;

  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!clinicId) {
    return NextResponse.json({ error: "Sin clínica activa" }, { status: 403 });
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
