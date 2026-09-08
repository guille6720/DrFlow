import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardPageHeader } from "@/core/components/layout/dashboard-page-header";
import { ProductRequiredError } from "@/core/products/products.server";

import {
  loadGeriatricsDashboardKpis,
  requireGeriatricsClinic,
} from "@/features/geriatria/server/geriatrics.server";

import { Card } from "@/components/ui/card";

const KPI_LINKS: { key: keyof Awaited<ReturnType<typeof loadGeriatricsDashboardKpis>>; label: string; href: string }[] = [
  { key: "activeResidents", label: "Residentes activos", href: "/geriatria/residentes" },
  { key: "occupiedBeds", label: "Camas ocupadas", href: "/geriatria/habitaciones" },
  { key: "freeBeds", label: "Camas libres", href: "/geriatria/habitaciones" },
  { key: "occupancyPercent", label: "Ocupación %", href: "/geriatria/habitaciones" },
  { key: "pendingMedications", label: "Medicaciones pendientes", href: "/geriatria/medicacion" },
  { key: "overdueMedications", label: "Medicaciones vencidas", href: "/geriatria/medicacion" },
  { key: "residentsWithAlerts", label: "Alertas clínicas", href: "/geriatria/residentes" },
  { key: "recentIncidents", label: "Incidentes (7d)", href: "/geriatria/incidentes" },
  { key: "scheduledTransfers", label: "Traslados programados", href: "/geriatria/traslados" },
  { key: "recentAdmissions", label: "Ingresos recientes (24h)", href: "/geriatria/residentes" },
];

export default async function GeriatriaPanelPage() {
  let clinicId: string;
  try {
    ({ clinicId } = await requireGeriatricsClinic());
  } catch (err) {
    if (err instanceof ProductRequiredError) redirect("/sin-productos");
    redirect("/dashboard");
  }

  let kpis: Awaited<ReturnType<typeof loadGeriatricsDashboardKpis>>;
  try {
    kpis = await loadGeriatricsDashboardKpis(clinicId);
  } catch {
    kpis = {
      activeResidents: 0,
      totalBeds: 0,
      occupiedBeds: 0,
      freeBeds: 0,
      occupancyPercent: 0,
      pendingMedications: 0,
      overdueMedications: 0,
      pendingControls: 0,
      overdueControls: 0,
      recentIncidents: 0,
      residentsWithAlerts: 0,
      scheduledTransfers: 0,
      recentAdmissions: 0,
    };
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Geriatría"
        subtitle="Panel operativo de residencia e internación geriátrica."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {KPI_LINKS.map((item) => {
          const value = kpis[item.key];
          const display = item.key === "occupancyPercent" ? `${value}%` : String(value);
          return (
            <Link
              key={item.key}
              href={item.href}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-400 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
            >
              <p className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                {display}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.label}</p>
            </Link>
          );
        })}
      </div>
      <Card title="Capacidad" description="Resumen de camas">
        <p className="text-sm text-slate-700 dark:text-slate-200">
          {kpis.activeResidents} residentes · {kpis.occupiedBeds}/{kpis.totalBeds} camas ocupadas ·{" "}
          {kpis.freeBeds} libres
        </p>
      </Card>
    </div>
  );
}
