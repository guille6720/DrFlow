import Link from "next/link";

import { DashboardPageHeader } from "@/core/components/layout/dashboard-page-header";
import {
  type CustomizationRowView,
  SuperadminCustomizationsTable,
} from "@/core/components/superadmin/superadmin-customizations-table";
import {
  getCustomizationEnvironment,
  listCustomizationClinics,
  listCustomizationMembers,
  loadAdminCustomizationState,
} from "@/core/customizations/admin.server";
import {
  defaultFeatureConfig,
  FEATURE_KEYS,
  featureConfigKeys,
  getFeatureDefinition,
} from "@/core/customizations/registry";
import type { FeatureMap, FeatureSettingRow } from "@/core/customizations/resolve";
import { requireSuperadminPage } from "@/core/entitlements/superadmin-guard.server";

import { Card } from "@/components/ui/card";

function buildRows(
  scope: "clinic" | "user",
  settings: FeatureSettingRow[],
  resolved: FeatureMap
): CustomizationRowView[] {
  const byKey = new Map(settings.map((s) => [s.feature_key, s]));
  return FEATURE_KEYS.map((key) => {
    const def = getFeatureDefinition(key);
    const setting = byKey.get(key);
    const eff = resolved[key];
    return {
      key,
      label: def.label,
      category: def.category,
      critical: def.critical,
      gatedBy: def.gatedBy,
      configurable: scope === "user" ? def.configurableByUser : def.configurableByClinic,
      configKeys: featureConfigKeys(key),
      defaultEnabled: def.defaultEnabled,
      defaultConfigJson: JSON.stringify(defaultFeatureConfig(key)),
      setting: setting
        ? {
            enabled: setting.enabled,
            configJson: setting.config == null ? null : JSON.stringify(setting.config),
          }
        : null,
      effective: {
        enabled: eff.enabled,
        source: eff.source,
        configSource: eff.configSource,
        configJson: JSON.stringify(eff.config),
      },
    };
  });
}

export default async function SuperadminCustomizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ clinicId?: string; userId?: string }>;
}) {
  await requireSuperadminPage();
  const params = await searchParams;
  const clinics = await listCustomizationClinics();
  const clinicId = clinics.some((c) => c.id === params.clinicId) ? params.clinicId! : null;
  const members = clinicId ? await listCustomizationMembers(clinicId) : [];
  const userId = clinicId && members.some((m) => m.userId === params.userId) ? params.userId! : null;
  const state = clinicId ? await loadAdminCustomizationState(clinicId, userId) : null;
  const environment = getCustomizationEnvironment();
  const clinicName = clinics.find((c) => c.id === clinicId)?.name;
  const member = members.find((m) => m.userId === userId);

  return (
    <div className="space-y-4">
      <DashboardPageHeader
        title="Personalizaciones"
        subtitle="Precedencia: USUARIO → CLÍNICA → DEFAULT. Solo restringe: nunca otorga plan, producto ni permisos."
      />

      <p className="text-xs text-slate-600 dark:text-slate-400">
        Entorno: <strong className="uppercase">{environment}</strong> · Todos los cambios quedan
        auditados (sin datos de pacientes).
      </p>

      <Card title="Clínica" description="Elegí la clínica a personalizar">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Clínica
            <select
              name="clinicId"
              defaultValue={clinicId ?? ""}
              className="mt-1 block min-w-[260px] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">— Seleccionar —</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
          >
            Ver
          </button>
        </form>
      </Card>

      {clinicId && state ? (
        <>
          <Card
            title={`Nivel clínica · ${clinicName ?? ""}`}
            description="Override para toda la clínica. «Heredar default» mantiene el comportamiento actual."
          >
            <SuperadminCustomizationsTable
              clinicId={clinicId}
              userId={null}
              scope="clinic"
              available={state.available}
              rows={buildRows("clinic", state.clinicRows, state.clinicResolved)}
            />
          </Card>

          <Card
            title="Overrides por usuario"
            description="Solo usuarios activos de la clínica seleccionada."
          >
            <form method="get" className="mb-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="clinicId" value={clinicId} />
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Usuario
                <select
                  name="userId"
                  defaultValue={userId ?? ""}
                  className="mt-1 block min-w-[260px] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="">— Seleccionar —</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.fullName} ({m.role})
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
              >
                Ver
              </button>
            </form>
            {userId && state.userResolved ? (
              <>
                <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">
                  Usuario: <strong>{member?.fullName}</strong> · {member?.role}
                </p>
                <SuperadminCustomizationsTable
                  clinicId={clinicId}
                  userId={userId}
                  scope="user"
                  available={state.available}
                  rows={buildRows("user", state.userRows, state.userResolved)}
                />
              </>
            ) : (
              <p className="text-sm text-slate-500">Elegí un usuario para ver o editar sus overrides.</p>
            )}
          </Card>

          <Link
            href={`/superadmin/clinics/${clinicId}`}
            className="text-sm font-medium text-teal-700 hover:underline"
          >
            ← Ver detalle comercial de la clínica
          </Link>
        </>
      ) : null}
    </div>
  );
}
