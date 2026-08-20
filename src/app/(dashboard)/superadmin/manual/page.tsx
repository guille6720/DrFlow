import { DashboardPageHeader } from "@/core/components/layout/dashboard-page-header";
import { SUPERADMIN_MANUAL_META } from "@/core/components/superadmin/manual/manual-data";
import { SuperadminManualView } from "@/core/components/superadmin/manual/superadmin-manual-view";
import { loadUsageThresholds } from "@/core/entitlements/superadmin-clinics.server";
import { requireSuperadminPage } from "@/core/entitlements/superadmin-guard.server";

export const dynamic = "force-dynamic";

export default async function SuperadminManualPage() {
  await requireSuperadminPage();
  const thresholds = await loadUsageThresholds();

  return (
    <div className="space-y-4">
      <DashboardPageHeader
        title={SUPERADMIN_MANUAL_META.title}
        subtitle={`Versión ${SUPERADMIN_MANUAL_META.version} · solo Superadmin · contenido comercial interno`}
      />
      <SuperadminManualView thresholds={thresholds} />
    </div>
  );
}
