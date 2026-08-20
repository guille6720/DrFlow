import Link from "next/link";

import { DashboardPageHeader } from "@/core/components/layout/dashboard-page-header";
import { getSuperadminDashboardStats } from "@/core/entitlements/superadmin-clinics.server";
import { requireSuperadminPage } from "@/core/entitlements/superadmin-guard.server";

import { Card } from "@/components/ui/card";

export default async function SuperadminDashboardPage() {
  await requireSuperadminPage();
  const stats = await getSuperadminDashboardStats();
  const planOrder = ["trial", "basic", "pro", "premium", "enterprise", "legacy"];

  return (
    <div className="space-y-4">
      <DashboardPageHeader
        title="Superadmin comercial"
        subtitle="Control de planes, cupos y recomendaciones. Solo staging / sin cambios automáticos de plan."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Clínicas" value={stats.totalClinics} />
        <Stat label="Suscripciones vivas" value={stats.activeSubscriptions} />
        <Stat label="Suspendidas / expiradas" value={stats.suspended} />
        <Stat label="Trials expirados" value={stats.expiredTrials} />
        <Stat label="Upgrade recomendado" value={stats.upgradeRecommendations} />
        <Stat label="Cerca del límite" value={stats.nearLimit} />
        <Stat label="En el límite" value={stats.atLimit} />
      </div>
      <Card title="Clínicas por plan" description="Distribución actual del catálogo comercial">
        <ul className="divide-y divide-slate-100 text-sm">
          {planOrder.map((key) => (
            <li key={key} className="flex items-center justify-between py-2">
              <span className="font-medium capitalize text-slate-800">{key}</span>
              <span className="tabular-nums text-slate-600">{stats.byPlan[key] ?? 0}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <Link href="/superadmin/recommendations" className="text-sm font-medium text-teal-700 hover:underline">
            Ver recomendaciones →
          </Link>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
