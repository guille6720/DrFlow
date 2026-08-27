import { NextResponse } from "next/server";

import { getActiveClinic } from "@/core/auth/session.server";
import { withObservabilityApiRoute } from "@/core/observability/api-route";
import { hasPermission } from "@/core/permissions/roles";
import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";
import { createClient } from "@/core/supabase/server";
import { searchQuerySchema } from "@/core/validations/params";

import type { MedicationCatalogResult } from "@/types/pharmacology";

export const dynamic = "force-dynamic";

export const GET = withObservabilityApiRoute("medications-search", async (request) => {
  const { searchParams } = new URL(request.url);
  const rawQ = searchParams.get("q")?.trim() ?? "";
  const rawLimit = Number(searchParams.get("limit") ?? 24);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 24, 1), 40);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  }

  const { role, isSuperadmin } = await getActiveClinic();
  if (
    !hasPermission(role, "viewPharmacology", isSuperadmin) &&
    !hasPermission(role, "editClinicalRecords", isSuperadmin) &&
    !hasPermission(role, "issuePrescriptions", isSuperadmin)
  ) {
    return NextResponse.json({ error: "Sin permisos para consultar el vademécum" }, { status: 403 });
  }

  const parsed = searchQuerySchema.safeParse(rawQ);
  if (!parsed.success) {
    return NextResponse.json({ data: [] });
  }

  const client = hasAdminClient() ? createAdminClient() : supabase;
  const { data, error } = await client.rpc("search_medication_catalog", {
    p_query: parsed.data,
    p_limit: limit,
  });

  if (error) {
    console.error("[api/medications/search] RPC failed:", error.message, error.code);

    // Fallback: direct table search if RPC grants/body are broken.
      if (hasAdminClient()) {
      const admin = createAdminClient();
      const pattern = `%${parsed.data}%`;
      const [pami, national] = await Promise.all([
        admin
          .from("pami_vademecum")
          .select(
            "id, alfabeta_id, active_ingredient, brand_name, presentation, laboratory, pvp_amount, coverage_pct, affiliate_amount, price_list_date"
          )
          .eq("is_active", true)
          .ilike("active_ingredient", pattern)
          .limit(limit),
        admin
          .from("national_medications")
          .select(
            "id, source_key, active_ingredient, brand_name, presentation, laboratory, reference_price, source_updated_at"
          )
          .eq("is_active", true)
          .ilike("active_ingredient", pattern)
          .limit(limit),
      ]);

      const [pamiBrand, nationalBrand] = await Promise.all([
        admin
          .from("pami_vademecum")
          .select(
            "id, alfabeta_id, active_ingredient, brand_name, presentation, laboratory, pvp_amount, coverage_pct, affiliate_amount, price_list_date"
          )
          .eq("is_active", true)
          .ilike("brand_name", pattern)
          .limit(limit),
        admin
          .from("national_medications")
          .select(
            "id, source_key, active_ingredient, brand_name, presentation, laboratory, reference_price, source_updated_at"
          )
          .eq("is_active", true)
          .ilike("brand_name", pattern)
          .limit(limit),
      ]);

      if (!pami.error && !national.error && !pamiBrand.error && !nationalBrand.error) {
        const pamiRows = [...(pami.data ?? []), ...(pamiBrand.data ?? [])];
        const nationalRows = [...(national.data ?? []), ...(nationalBrand.data ?? [])];
        const seen = new Set<string>();
        const mapped: MedicationCatalogResult[] = [];

        for (const row of pamiRows) {
          if (seen.has(row.id)) continue;
          seen.add(row.id);
          mapped.push({
            id: row.id,
            catalog_source: "alfabeta",
            product_code: String(row.alfabeta_id),
            active_ingredient: row.active_ingredient,
            brand_name: row.brand_name,
            presentation: row.presentation,
            laboratory: row.laboratory,
            reference_price: row.pvp_amount,
            coverage_pct: row.coverage_pct,
            affiliate_amount: row.affiliate_amount,
            price_list_date: row.price_list_date,
          });
        }
        for (const row of nationalRows) {
          if (seen.has(row.id)) continue;
          seen.add(row.id);
          mapped.push({
            id: row.id,
            catalog_source: "siafar",
            product_code: row.source_key,
            active_ingredient: row.active_ingredient,
            brand_name: row.brand_name,
            presentation: row.presentation,
            laboratory: row.laboratory,
            reference_price: row.reference_price,
            coverage_pct: null,
            affiliate_amount: null,
            price_list_date: row.source_updated_at,
          });
        }

        return NextResponse.json({ data: mapped.slice(0, limit) });
      }
    }

    return NextResponse.json(
      {
        error: "No se pudo buscar el vademécum.",
        code: "MEDICATION_SEARCH_FAILED",
        detail: error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: (data ?? []) as MedicationCatalogResult[] });
});
