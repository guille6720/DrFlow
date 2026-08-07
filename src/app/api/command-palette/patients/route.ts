import { NextResponse } from "next/server";
import { z } from "zod";

import { getActiveClinic, getActiveClinicId, getSession } from "@/core/auth/session.server";
import { withObservabilityApiRoute } from "@/core/observability/api-route";
import { hasPermission } from "@/core/permissions/roles";
import { PATIENT_SEARCH_API_LIMIT } from "@/core/supabase/pagination";
import { createClient } from "@/core/supabase/server";
import { patientPickerSearchQuerySchema } from "@/core/validations/params";

import { applyPatientSearchFilter } from "@/features/pacientes/utils/patient-search";

import { mapPatientHits } from "@/lib/utils/command-palette-search";

const limitSchema = z.coerce.number().int().min(1).max(50).optional();

export const GET = withObservabilityApiRoute("command_palette_patients", async (request, ctx) => {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const qParsed = patientPickerSearchQuerySchema.safeParse(url.searchParams.get("q")?.trim() ?? "");
  if (!qParsed.success) {
    return NextResponse.json({ patients: [] });
  }
  const q = qParsed.data;
  const cobertura = url.searchParams.get("cobertura");
  const extended = url.searchParams.get("extended") === "1";
  const limitParsed = limitSchema.safeParse(url.searchParams.get("limit") ?? undefined);
  const limit = limitParsed.success ? limitParsed.data : PATIENT_SEARCH_API_LIMIT;

  const clinicId = await getActiveClinicId();
  ctx.clinicId = clinicId;
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

  let query = extended
    ? supabase
        .from("patients")
        .select("id, first_name, last_name, document_number, insurance_number, phone, address")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("last_name")
        .limit(limit ?? PATIENT_SEARCH_API_LIMIT)
    : supabase
        .from("patients")
        .select("id, first_name, last_name, document_number")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("last_name")
        .limit(limit ?? PATIENT_SEARCH_API_LIMIT);

  if (cobertura === "pami") {
    query = query.ilike("insurance_provider", "%PAMI%");
  }

  query = applyPatientSearchFilter(query, q);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ patients: [], error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const patients = extended ? rows : mapPatientHits(rows);

  return NextResponse.json({ patients });
});
