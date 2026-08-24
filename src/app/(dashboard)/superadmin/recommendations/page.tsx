import Link from "next/link";

import { DashboardPageHeader } from "@/core/components/layout/dashboard-page-header";
import { ManualHelpLink } from "@/core/components/superadmin/manual/manual-help-link";
import { SuperadminRecommendationActions } from "@/core/components/superadmin/superadmin-recommendation-actions";
import { SuperadminSyncRecommendationsButton } from "@/core/components/superadmin/superadmin-sync-recommendations-button";
import { listSuperadminClinicCommercialRows } from "@/core/entitlements/superadmin-clinics.server";
import { requireSuperadminPage } from "@/core/entitlements/superadmin-guard.server";
import { untypedDb } from "@/core/entitlements/untyped-db.server";
import { createClient } from "@/core/supabase/server";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default async function SuperadminRecommendationsPage() {
  await requireSuperadminPage();
  const rows = (await listSuperadminClinicCommercialRows()).filter(
    (row) => row.shouldRecommendUpgrade || row.planKey === "legacy"
  );

  const supabase = await createClient();
  const { data: stored } = await untypedDb(supabase)
    .from("clinic_plan_recommendations")
    .select("id, clinic_id, status")
    .in("status", ["recommended", "reviewed"]);
  const recommendationIdByClinic = new Map(
    (stored ?? []).map((row) => [String(row.clinic_id), String(row.id)])
  );

  return (
    <div className="space-y-4">
      <DashboardPageHeader
        title="Recomendaciones"
        subtitle="Alertas operativas. Ningún plan se cambia solo."
      />
      <div className="flex justify-end">
        <ManualHelpLink anchor="recommendations" label="Ayuda · Recomendaciones" />
      </div>
      <SuperadminSyncRecommendationsButton />
      <div className="space-y-3">
        {rows.map((row) => (
          <Card
            key={row.clinicId}
            title={
              row.planKey === "legacy"
                ? `UPGRADE / REVIEW — ${row.clinicName}`
                : `UPGRADE RECOMMENDED — ${row.clinicName}`
            }
            description={
              row.planKey === "legacy"
                ? "Legacy — revisión manual"
                : `Actual: ${row.planKey} → ${row.recommendedPlan}`
            }
          >
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge>Actual: {row.planKey}</Badge>
              {row.recommendedPlan ? <Badge variant="warning">{row.recommendedPlan}</Badge> : null}
              <Badge variant="info">{row.recommendationSeverity ?? "info"}</Badge>
            </div>
            <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
              {row.recommendationReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            <div className="mb-3 flex flex-wrap gap-3 text-sm">
              <Link
                href={`/superadmin/clinics/${row.clinicId}`}
                className="font-medium text-teal-700 hover:underline"
              >
                Ver clínica
              </Link>
              <Link
                href={`/superadmin/clinics/${row.clinicId}`}
                className="font-medium text-slate-700 hover:underline dark:text-slate-200"
              >
                Cambiar plan
              </Link>
            </div>
            <SuperadminRecommendationActions
              clinicId={row.clinicId}
              recommendationId={recommendationIdByClinic.get(row.clinicId) ?? null}
            />
          </Card>
        ))}
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No hay recomendaciones abiertas.</p>
        ) : null}
      </div>
    </div>
  );
}
