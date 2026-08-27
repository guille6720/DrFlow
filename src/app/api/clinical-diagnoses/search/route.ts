import { NextResponse } from "next/server";

import { getActiveClinic } from "@/core/auth/session.server";
import { withObservabilityApiRoute } from "@/core/observability/api-route";
import { hasPermission } from "@/core/permissions/roles";
import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";
import { createClient } from "@/core/supabase/server";
import { searchQuerySchema } from "@/core/validations/params";

import type { ClinicalDiagnosisCatalogHit } from "@/features/historias/types/clinical-diagnosis-catalog";

export const dynamic = "force-dynamic";

const SELECT_FIELDS =
  "id,name,normalized_name,snomed_code,cie10_code,cie11_code,category,synonyms";

function mapRows(rows: ClinicalDiagnosisCatalogHit[]): ClinicalDiagnosisCatalogHit[] {
  return rows.map((row) => ({
    ...row,
    synonyms: Array.isArray(row.synonyms) ? row.synonyms : [],
  }));
}

function rankHits(
  rows: ClinicalDiagnosisCatalogHit[],
  query: string,
  limit: number
): ClinicalDiagnosisCatalogHit[] {
  const qLower = query.toLowerCase();
  return rows
    .map((row) => {
      const name = row.name?.toLowerCase() ?? "";
      const code = row.cie10_code?.toLowerCase() ?? "";
      const synonyms = Array.isArray(row.synonyms) ? row.synonyms : [];
      let rank = 3;
      if (code === qLower || code.startsWith(qLower)) rank = 0;
      else if (name.startsWith(qLower)) rank = 1;
      else if (synonyms.some((s) => String(s).toLowerCase().includes(qLower))) rank = 2;
      return { row, rank };
    })
    .sort((a, b) => a.rank - b.rank || a.row.name.localeCompare(b.row.name))
    .slice(0, limit)
    .map(({ row }) => row);
}

export const GET = withObservabilityApiRoute("clinical-diagnoses-search", async (request) => {
  const { searchParams } = new URL(request.url);
  const rawQ = searchParams.get("q")?.trim() ?? "";
  const rawLimit = Number(searchParams.get("limit") ?? 10);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 10, 1), 25);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  }

  const { role, isSuperadmin } = await getActiveClinic();
  if (!hasPermission(role, "viewClinicalRecords", isSuperadmin)) {
    return NextResponse.json({ error: "Sin permisos para buscar diagnósticos" }, { status: 403 });
  }

  const parsed = searchQuerySchema.safeParse(rawQ);
  if (!parsed.success) {
    return NextResponse.json({ data: [] });
  }
  const query = parsed.data;

  if (!hasAdminClient()) {
    return NextResponse.json(
      {
        error: "No se pudo buscar en el catálogo de diagnósticos.",
        code: "SERVICE_ROLE_MISSING",
      },
      { status: 503 }
    );
  }

  const admin = createAdminClient();
  const pattern = `%${query}%`;
  const codePrefix = `${query}%`;

  const [byName, byCode, byNormalized] = await Promise.all([
    admin
      .from("clinical_diagnoses")
      .select(SELECT_FIELDS)
      .eq("active", true)
      .ilike("name", pattern)
      .limit(limit),
    admin
      .from("clinical_diagnoses")
      .select(SELECT_FIELDS)
      .eq("active", true)
      .ilike("cie10_code", codePrefix)
      .limit(limit),
    admin
      .from("clinical_diagnoses")
      .select(SELECT_FIELDS)
      .eq("active", true)
      .ilike("normalized_name", pattern)
      .limit(limit),
  ]);

  const firstError = byName.error ?? byCode.error ?? byNormalized.error;
  if (firstError) {
    console.error(
      "[api/clinical-diagnoses/search] table query failed:",
      firstError.message,
      firstError.code
    );

    const { data: rpcData, error: rpcError } = await admin.rpc("search_clinical_diagnoses", {
      p_query: query,
      p_limit: limit,
    });
    if (rpcError) {
      console.error(
        "[api/clinical-diagnoses/search] RPC failed:",
        rpcError.message,
        rpcError.code
      );
      return NextResponse.json(
        {
          error: "No se pudo buscar en el catálogo de diagnósticos.",
          code: "CATALOG_QUERY_FAILED",
          detail: firstError.message,
        },
        { status: 500 }
      );
    }
    return NextResponse.json({
      data: mapRows((rpcData ?? []) as ClinicalDiagnosisCatalogHit[]),
    });
  }

  const merged = new Map<string, ClinicalDiagnosisCatalogHit>();
  for (const row of [...(byName.data ?? []), ...(byCode.data ?? []), ...(byNormalized.data ?? [])]) {
    merged.set(row.id, row as ClinicalDiagnosisCatalogHit);
  }

  return NextResponse.json({
    data: mapRows(rankHits([...merged.values()], query, limit)),
  });
});
