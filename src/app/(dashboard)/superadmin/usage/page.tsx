import { DashboardPageHeader } from "@/core/components/layout/dashboard-page-header";
import {
  listSuperadminClinicCommercialRows,
  loadUsageThresholds,
} from "@/core/entitlements/superadmin-clinics.server";
import { requireSuperadminPage } from "@/core/entitlements/superadmin-guard.server";
import { classifyUsageBand, usagePercentage } from "@/core/entitlements/usage-thresholds";

import { Badge } from "@/components/ui/badge";

export default async function SuperadminUsagePage() {
  await requireSuperadminPage();
  const [rows, thresholds] = await Promise.all([
    listSuperadminClinicCommercialRows(),
    loadUsageThresholds(),
  ]);

  return (
    <div className="space-y-4">
      <DashboardPageHeader
        title="Consumo"
        subtitle={`Umbrales: info ${thresholds.infoPct}% · warn ${thresholds.warnPct}% · critical ${thresholds.criticalPct}%`}
      />
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Clínica</th>
              <th className="px-3 py-2">Pacientes</th>
              <th className="px-3 py-2">%</th>
              <th className="px-3 py-2">Banda</th>
              <th className="px-3 py-2">IA mes</th>
              <th className="px-3 py-2">WhatsApp mes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const pct = usagePercentage(row.patients, row.limitPatients);
              const band = classifyUsageBand(row.patients, row.limitPatients, thresholds);
              return (
                <tr key={row.clinicId}>
                  <td className="px-3 py-2 font-medium">{row.clinicName}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.patients}
                    {row.limitPatients != null ? ` / ${row.limitPatients}` : " / ∞"}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{pct == null ? "—" : `${pct}%`}</td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={
                        band === "exceeded" || band === "critical"
                          ? "danger"
                          : band === "warning"
                            ? "warning"
                            : band === "info"
                              ? "info"
                              : "default"
                      }
                    >
                      {band}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{row.usageAi}</td>
                  <td className="px-3 py-2 tabular-nums">{row.usageWhatsapp}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
