import Link from "next/link";
import { notFound } from "next/navigation";

import { DashboardPageHeader } from "@/core/components/layout/dashboard-page-header";
import { ManualHelpLink } from "@/core/components/superadmin/manual/manual-help-link";
import { SuperadminClearOverrideButton } from "@/core/components/superadmin/superadmin-clear-override-button";
import { SuperadminClinicPlanForm } from "@/core/components/superadmin/superadmin-clinic-plan-form";
import { SuperadminOverrideForm } from "@/core/components/superadmin/superadmin-override-form";
import { listEntitlementsAdminOverrides } from "@/core/entitlements/admin.server";
import { ADMIN_ASSIGNABLE_PLAN_KEYS } from "@/core/entitlements/admin-constants";
import { listSuperadminClinicCommercialRows } from "@/core/entitlements/superadmin-clinics.server";
import { requireSuperadminPage } from "@/core/entitlements/superadmin-guard.server";
import { logServerError } from "@/core/errors/log-error.server";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default async function SuperadminClinicDetailPage({
  params,
}: {
  params: Promise<{ clinicId: string }>;
}) {
  await requireSuperadminPage();
  const { clinicId } = await params;

  let clinic: Awaited<ReturnType<typeof listSuperadminClinicCommercialRows>>[number] | undefined;
  let clinicOverrides: Awaited<ReturnType<typeof listEntitlementsAdminOverrides>> = [];
  let loadError: string | null = null;

  try {
    const [rows, overrides] = await Promise.all([
      listSuperadminClinicCommercialRows(),
      listEntitlementsAdminOverrides(),
    ]);
    clinic = rows.find((r) => r.clinicId === clinicId);
    clinicOverrides = overrides.filter((o) => o.clinicId === clinicId);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Error al cargar datos comerciales";
    logServerError("superadmin.clinic-detail", err, { persist: false });
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <DashboardPageHeader title="Clínica" subtitle="Detalle comercial" />
        <Card title="No pudimos cargar esta clínica" description="El listado comercial falló">
          <p className="text-sm text-slate-700 dark:text-slate-200">{loadError}</p>
          <p className="mt-2 text-sm text-slate-500">
            Probá volver al listado e ingresar de nuevo. Si persiste, revisá que el catálogo de planes
            esté disponible en Staging.
          </p>
          <Link
            href="/superadmin/clinics"
            className="mt-4 inline-block text-sm font-medium text-teal-700 hover:underline"
          >
            ← Volver a clínicas
          </Link>
        </Card>
      </div>
    );
  }

  if (!clinic) notFound();

  return (
    <div className="space-y-4">
      <DashboardPageHeader
        title={clinic.clinicName}
        subtitle="Detalle comercial — los datos clínicos no se modifican al cambiar el plan."
      />
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{clinic.planKey ?? "sin plan"}</Badge>
        <Badge variant="info">{clinic.status ?? "—"}</Badge>
        {clinic.shouldRecommendUpgrade ? (
          <Badge variant="warning">Recomienda {clinic.recommendedPlan}</Badge>
        ) : null}
        <span className="ml-auto flex flex-wrap gap-3">
          <ManualHelpLink anchor="change-plan" label="Ayuda · Cambiar plan" />
          <ManualHelpLink anchor="overrides" label="Ayuda · Overrides" />
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Suscripción" description="Estado comercial actual">
          <dl className="space-y-2 text-sm">
            <Row label="Plan" value={clinic.planKey ?? "—"} />
            <Row label="Estado" value={clinic.status ?? "—"} />
            <Row
              label="Inicio"
              value={clinic.startsAt ? new Date(clinic.startsAt).toLocaleString("es-AR") : "—"}
            />
            <Row
              label="Fin trial comercial"
              value={clinic.trialEndsAt ? new Date(clinic.trialEndsAt).toLocaleString("es-AR") : "—"}
            />
            <Row
              label="Usuarios / Prof. / Pacientes"
              value={`${clinic.users} / ${clinic.professionals} / ${clinic.patients}`}
            />
            <Row label="Uso IA / WhatsApp (mes)" value={`${clinic.usageAi} / ${clinic.usageWhatsapp}`} />
          </dl>
        </Card>

        <Card title="Recomendación" description="Motor centralizado — sin cambio automático">
          {clinic.planKey === "legacy" ? (
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Legacy — revisión comercial manual requerida. Podés asignar Essential/Pro u otro plan
              abajo.
            </p>
          ) : clinic.shouldRecommendUpgrade ? (
            <div className="space-y-2 text-sm">
              <p>
                Plan actual: <strong>{clinic.planKey}</strong>
              </p>
              <p>
                Recomendado: <strong>{clinic.recommendedPlan}</strong> ({clinic.recommendationSeverity})
              </p>
              <ul className="list-disc space-y-1 pl-5 text-slate-700 dark:text-slate-300">
                {(clinic.recommendationReasons ?? []).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">Sin upgrade recomendado.</p>
          )}
        </Card>
      </div>

      <Card title="Cambiar plan" description="Confirmación con diff de features/límites">
        <SuperadminClinicPlanForm
          clinicId={clinic.clinicId}
          currentPlanKey={clinic.planKey}
          planKeys={ADMIN_ASSIGNABLE_PLAN_KEYS}
        />
      </Card>

      <Card title="Overrides" description="Fuente efectiva: PLAN / OVERRIDE">
        <SuperadminOverrideForm clinicId={clinic.clinicId} />
        <ul className="mt-4 divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {clinicOverrides.map((ov) => (
            <li
              key={`${ov.clinicId}-${ov.featureKey}`}
              className="flex items-center justify-between gap-3 py-2"
            >
              <div>
                <p className="font-medium">{ov.featureKey}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {ov.enabled ? "enabled" : "disabled"}
                  {ov.endsAt ? ` · hasta ${new Date(ov.endsAt).toLocaleString("es-AR")}` : " · permanente"}
                  {ov.reason ? ` · ${ov.reason}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase text-teal-700">OVERRIDE</span>
                <SuperadminClearOverrideButton clinicId={clinic.clinicId} featureKey={ov.featureKey} />
              </div>
            </li>
          ))}
          {clinicOverrides.length === 0 ? (
            <li className="py-3 text-slate-500">Sin overrides activos.</li>
          ) : null}
        </ul>
      </Card>

      <Link href="/superadmin/clinics" className="text-sm font-medium text-teal-700 hover:underline">
        ← Volver a clínicas
      </Link>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900 dark:text-slate-100">{value}</dd>
    </div>
  );
}
