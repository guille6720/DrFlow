import { DashboardPageHeader } from "@/core/components/layout/dashboard-page-header";
import { ManualHelpLink } from "@/core/components/superadmin/manual/manual-help-link";
import { SuperadminPlanEditForm } from "@/core/components/superadmin/superadmin-plan-edit-form";
import { SuperadminPlanFeatureForm } from "@/core/components/superadmin/superadmin-plan-feature-form";
import { listSuperadminPlans } from "@/core/entitlements/superadmin-catalog.server";
import { requireSuperadminPage } from "@/core/entitlements/superadmin-guard.server";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default async function SuperadminPlansPage() {
  await requireSuperadminPage();
  const plans = await listSuperadminPlans();

  return (
    <div className="space-y-4">
      <DashboardPageHeader
        title="Planes"
        subtitle="Catálogo comercial. Legacy permanece interno / no público."
      />
      <div className="flex justify-end">
        <ManualHelpLink anchor="plans" label="Ayuda · Planes" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {plans.map((plan) => (
          <Card key={plan.id} title={plan.name} description={plan.key}>
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge variant={plan.isActive ? "success" : "default"}>
                {plan.isActive ? "activo" : "inactivo"}
              </Badge>
              {plan.isPublic ? <Badge variant="info">público</Badge> : <Badge>privado</Badge>}
              {plan.isInternal ? <Badge variant="warning">interno</Badge> : null}
              {plan.key === "legacy" ? <Badge variant="danger">migration-only</Badge> : null}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {plan.description ?? "Sin descripción"}
            </p>
            <SuperadminPlanEditForm
              planKey={plan.key}
              name={plan.name}
              description={plan.description}
              displayOrder={plan.displayOrder}
              isPublic={plan.isPublic}
              isActive={plan.isActive}
              isLegacy={plan.key === "legacy"}
              isTrial={plan.key === "trial"}
            />
            <SuperadminPlanFeatureForm planKey={plan.key} />
          </Card>
        ))}
      </div>
    </div>
  );
}
