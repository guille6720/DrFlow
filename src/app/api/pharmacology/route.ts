import { NextResponse } from "next/server";

import { getActiveClinic, getActiveClinicId } from "@/core/auth/session.server";
import { withObservabilityApiRoute } from "@/core/observability/api-route";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";
import { firstZodIssue } from "@/core/validations/params";
import { pharmacologyApiQuerySchema } from "@/core/validations/pharmacology-api";

export const GET = withObservabilityApiRoute("pharmacology", async (request, ctx) => {
  const { searchParams } = new URL(request.url);
  const parsed = pharmacologyApiQuerySchema.safeParse({
    q: searchParams.get("q")?.trim() || undefined,
    pathologyId: searchParams.get("pathologyId")?.trim() || undefined,
    symptomIds: searchParams.get("symptomIds")?.trim()
      ? searchParams.get("symptomIds")!.trim().split(",").filter(Boolean)
      : undefined,
    type: searchParams.get("type")?.trim() || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: firstZodIssue(parsed.error) }, { status: 400 });
  }

  const { q: query, pathologyId, symptomIds, type } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { role, isSuperadmin } = await getActiveClinic();
  ctx.clinicId = await getActiveClinicId();

  if (!hasPermission(role, "viewPharmacology", isSuperadmin)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  if (pathologyId) {
    const { loadPathologyDrugsCached } = await import("@/lib/server/cached-reference-data");
    try {
      const data = await loadPathologyDrugsCached(pathologyId);
      return NextResponse.json(
        { data },
        { headers: { "Cache-Control": "private, max-age=3600" } }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error loading drugs";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (symptomIds?.length) {
    const { data, error } = await supabase.rpc("search_pathologies_by_symptoms", {
      p_symptom_ids: symptomIds,
      p_limit: 12,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  }

  if (!query || query.length < 2) {
    return NextResponse.json({ data: [] });
  }

  if (type === "symptoms") {
    const { data, error } = await supabase.rpc("search_symptoms", {
      p_query: query,
      p_limit: 12,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  }

  const { data, error } = await supabase.rpc("search_pathologies", {
    p_query: query,
    p_limit: 12,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
});
