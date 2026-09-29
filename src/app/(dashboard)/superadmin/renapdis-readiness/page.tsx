import { DashboardPageHeader } from "@/core/components/layout/dashboard-page-header";
import { NationalRxReadinessCard } from "@/core/components/superadmin/national-rx-readiness-card";
import { requireSuperadminPage } from "@/core/entitlements/superadmin-guard.server";
import { evaluateNationalRxReadiness } from "@/core/renapdis/national-readiness";
import {
  getRenapdisOperationalReadiness,
  type ReadinessState,
} from "@/core/renapdis/operational-readiness";
import { resolveRefepsValidationConfig, resolveRepositoryConfig } from "@/core/renapdis/repository/repository-config";

import { Card } from "@/components/ui/card";

const STATE_LABEL: Record<ReadinessState, string> = {
  ready: "Ready",
  partial: "Partial",
  blocked_external: "Blocked (external)",
  not_configured: "Not configured",
};

const STATE_CLASS: Record<ReadinessState, string> = {
  ready: "bg-emerald-50 text-emerald-800 border-emerald-200",
  partial: "bg-amber-50 text-amber-900 border-amber-200",
  blocked_external: "bg-slate-100 text-slate-800 border-slate-300",
  not_configured: "bg-rose-50 text-rose-900 border-rose-200",
};

export default async function SuperadminRenapdisReadinessPage() {
  await requireSuperadminPage();
  const items = getRenapdisOperationalReadiness();
  // Platform-level view: feature/establishment are per clinic (see Personalizaciones).
  const platform = evaluateNationalRxReadiness({ featureEnabled: true, productEntitled: true, establishmentCode: "n/a" });
  const repo = resolveRepositoryConfig();
  const refeps = resolveRefepsValidationConfig();

  return (
    <div className="space-y-4">
      <DashboardPageHeader
        title="ReNaPDiS Operational Readiness"
        subtitle="Staging status only. Never auto-claims ministry approval. External Ministry/DNSISA blockers remain explicit. See docs/RENAPDIS-INTEGRATION-ARCHITECTURE.md in the repo."
      />
      <Card
        title="Integración ReNaPDiS (plataforma)"
        description="REFEPS valida profesionales; el repositorio ReNaPDiS registra la receta y otorga el CUIR. Sin secretos."
      >
        <NationalRxReadinessCard readiness={platform} showFeature={false} />
        <div className="mt-3 grid gap-1 text-xs text-slate-600 dark:text-slate-400">
          <p>
            Proveedor de repositorio: <strong>{repo.providerId ?? "—"}</strong> · motivo: <code>{repo.reason}</code>
            {repo.authMode ? (
              <>
                {" "}
                · auth: <code>{repo.authMode}</code>
              </>
            ) : null}
          </p>
          {repo.missing.length > 0 ? (
            <p>
              Variables faltantes: <code>{repo.missing.join(", ")}</code>
            </p>
          ) : null}
          <p>
            REFEPS: <code>{refeps.reason}</code>
            {refeps.usingLegacyVars ? " · usando variables legacy REFEPS_API_*" : null}
          </p>
          <p>
            Ready for production: <strong>{platform.readyForNationalPrescription ? "SÍ" : "NO"}</strong>
          </p>
        </div>
      </Card>
      <Card title="Capability checklist" description="Evidence-based states for fiscalization review">
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="space-y-2 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-900">{item.label}</p>
                <span
                  className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${STATE_CLASS[item.state]}`}
                >
                  {STATE_LABEL[item.state]}
                </span>
              </div>
              <p className="text-sm text-slate-600">{item.evidence}</p>
              {item.actionNeeded ? (
                <p className="text-sm text-slate-800">
                  <span className="font-medium">Action: </span>
                  {item.actionNeeded}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
