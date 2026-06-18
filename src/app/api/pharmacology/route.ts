import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveClinic } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/roles";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const pathologyId = searchParams.get("pathologyId")?.trim();
  const symptomIdsParam = searchParams.get("symptomIds")?.trim();
  const type = searchParams.get("type")?.trim() ?? "pathology";

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

  if (symptomIdsParam) {
    const symptomIds = symptomIdsParam.split(",").filter(Boolean);
    const { data, error } = await supabase.rpc("search_pathologies_by_symptoms", {
      p_symptom_ids: symptomIds,
      p_limit: 12,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  }

  if (query.length < 2) {
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
