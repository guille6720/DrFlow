import Link from "next/link";
import { redirect } from "next/navigation";

import { getActiveClinic } from "@/core/auth/session.server";
import { DashboardPageHeader } from "@/core/components/layout/dashboard-page-header";
import { EntitlementsAdminPanel } from "@/core/components/qa/entitlements-admin-panel";
import {
  listEntitlementsAdminClinics,
  listEntitlementsAdminOverrides,
} from "@/core/entitlements/admin.server";
import { canAccessRoute } from "@/core/permissions/roles";

export default async function QaComercialPage() {
  const { role, isSuperadmin } = await getActiveClinic();
  if (!canAccessRoute(role, "/qa", isSuperadmin)) {
    redirect("/dashboard");
  }

  const [clinics, overrides] = await Promise.all([
    listEntitlementsAdminClinics(),
    listEntitlementsAdminOverrides(),
  ]);

  return (
    <>
      <DashboardPageHeader
        title="Comercial"
        subtitle="Asignación de planes, overrides y estado comercial. No altera Mercado Pago."
      />
      <div className="space-y-4 p-4 sm:p-6">
        <p className="text-sm text-slate-600">
          <Link href="/qa" className="font-medium text-teal-800 underline">
            Volver al checklist QA
          </Link>
          . El plan <code>legacy</code> es interno: no lo uses en altas automáticas.
        </p>
        <EntitlementsAdminPanel clinics={clinics} overrides={overrides} />
      </div>
    </>
  );
}
