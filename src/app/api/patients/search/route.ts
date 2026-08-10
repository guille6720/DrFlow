import { NextResponse } from "next/server";
import { z } from "zod";

import { getActiveClinic, getActiveClinicId, getSession } from "@/core/auth/session.server";
import { withObservabilityApiRoute } from "@/core/observability/api-route";
import { hasPermission } from "@/core/permissions/roles";
import { PATIENT_SEARCH_API_LIMIT } from "@/core/supabase/pagination";
import { createClient } from "@/core/supabase/server";

import { searchPatientsForClinic } from "@/features/pacientes/server/search-patients";
import { validatePatientSearchQuery } from "@/features/pacientes/utils/patient-search-query";

const limitSchema = z.coerce.number().int().min(1).max(50).optional();

export const GET = withObservabilityApiRoute("patients_search", async (request, ctx) => {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = validatePatientSearchQuery(url.searchParams.get("q")?.trim() ?? "");
  if (!parsed.ok) {
    return NextResponse.json({ patients: [] });
  }

  const cobertura = url.searchParams.get("cobertura");
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
  const { patients, error } = await searchPatientsForClinic(supabase, {
    clinicId,
    q: parsed.q,
    limit,
    cobertura: cobertura === "pami" ? "pami" : undefined,
  });

  if (error) {
    return NextResponse.json({ patients: [], error }, { status: 500 });
  }

  return NextResponse.json({ patients });
});
