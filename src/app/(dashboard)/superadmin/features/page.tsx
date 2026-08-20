import { DashboardPageHeader } from "@/core/components/layout/dashboard-page-header";
import { SuperadminFeatureActiveToggle } from "@/core/components/superadmin/superadmin-feature-active-toggle";
import { listSuperadminFeatures } from "@/core/entitlements/superadmin-catalog.server";
import { requireSuperadminPage } from "@/core/entitlements/superadmin-guard.server";

import { Badge } from "@/components/ui/badge";

export default async function SuperadminFeaturesPage() {
  await requireSuperadminPage();
  const features = await listSuperadminFeatures();

  return (
    <div className="space-y-4">
      <DashboardPageHeader
        title="Features"
        subtitle="Catálogo. Preferir desactivar antes que borrar features referenciadas."
      />
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            <tr>
              <th className="px-3 py-2">Key</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Metered</th>
              <th className="px-3 py-2">Planes</th>
              <th className="px-3 py-2">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {features.map((feature) => (
              <tr key={feature.id}>
                <td className="px-3 py-2 font-mono text-xs">{feature.key}</td>
                <td className="px-3 py-2">{feature.name}</td>
                <td className="px-3 py-2">{feature.featureType}</td>
                <td className="px-3 py-2">
                  <Badge variant={feature.isActive ? "success" : "default"}>
                    {feature.isActive ? "active" : "inactive"}
                  </Badge>
                </td>
                <td className="px-3 py-2">{feature.usageMetered ? "sí" : "no"}</td>
                <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                  {feature.planKeys.join(", ") || "—"}
                </td>
                <td className="px-3 py-2">
                  <SuperadminFeatureActiveToggle
                    featureKey={feature.key}
                    isActive={feature.isActive}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
