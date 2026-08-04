import { NextResponse } from "next/server";
import { createClient } from "@/core/supabase/server";
import { getActiveClinic } from "@/core/auth/session";
import { hasPermission } from "@/core/permissions/roles";
import { pharmacologyApiQuerySchema } from "@/core/validations/pharmacology-api";
import { firstZodIssue } from "@/core/validations/params";

export async function GET(request: Request) {
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
  if (!hasPermission(role, "viewPharmacology", isSuperadmin)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  if (pathologyId) {
    const { data, error } = await supabase
      .from("pathology_drugs")
      .select(
        "id, treatment_line, priority, indication_notes, dosage_reference, drugs(id, name, active_ingredient, atc_code, atc_description, presentation, route)"
      )
      .eq("pathology_id", pathologyId)
      .eq("is_active", true)
      .order("treatment_line")
      .order("priority");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
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
}
