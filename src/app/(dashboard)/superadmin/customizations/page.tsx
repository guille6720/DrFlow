import Link from "next/link";

import { DashboardPageHeader } from "@/core/components/layout/dashboard-page-header";
import { NationalRxReadinessCard } from "@/core/components/superadmin/national-rx-readiness-card";
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
  type FeatureKey,
  getFeatureDefinition,
} from "@/core/customizations/registry";
import type { FeatureMap, FeatureSettingRow } from "@/core/customizations/resolve";
import { requireSuperadminPage } from "@/core/entitlements/superadmin-guard.server";
import { loadClinicProducts } from "@/core/products/products.server";
import { evaluateNationalRxReadiness } from "@/core/renapdis/national-readiness";
import { createClient } from "@/core/supabase/server";

import { Card } from "@/components/ui/card";

async function loadClinicEstablishmentCode(clinicId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("clinics").select("refeps_establishment_code").eq("id", clinicId).maybeSingle();
  return data?.refeps_establishment_code ?? null;
}

type ProductGates = { clinic: boolean; geriatrics: boolean; clinicId: string };

function gateFor(key: FeatureKey, products: ProductGates): CustomizationRowView["gate"] {
  const href = `/superadmin/clinics/${products.clinicId}`;
  if (key === "clinic_module") return { label: "El producto Clínica", active: products.clinic, href };
  if (key === "geriatrics_module") return { label: "El producto Geriatría", active: products.geriatrics, href };
  return null;
}

function buildRows(
  scope: "clinic" | "user",
  settings: FeatureSettingRow[],
  resolved: FeatureMap,
  products: ProductGates
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
      gate: gateFor(key, products),
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
  const { userId: superadminId } = await requireSuperadminPage();
  const params = await searchParams;
  const clinics = await listCustomizationClinics();
  const clinicId = clinics.some((c) => c.id === params.clinicId) ? params.clinicId! : null;
  const members = clinicId ? await listCustomizationMembers(clinicId) : [];
  const userId = clinicId && members.some((m) => m.userId === params.userId) ? params.userId! : null;
  const [state, productsSnap] = clinicId
    ? await Promise.all([loadAdminCustomizationState(clinicId, userId), loadClinicProducts(clinicId)])
    : [null, null];
  const products: ProductGates = {
    clinicId: clinicId ?? "",
    clinic: productsSnap?.clinic ?? true,
    geriatrics: productsSnap?.geriatrics ?? false,
  };
  const nationalRx =
    clinicId && state
      ? evaluateNationalRxReadiness({
          featureEnabled: state.clinicResolved.national_electronic_prescription?.enabled ?? false,
          productEntitled: products.clinic,
          establishmentCode: await loadClinicEstablishmentCode(clinicId),
        })
      : null;
  const superadminIsMember = members.some((m) => m.userId === superadminId);
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
          <div className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-950">
            <p className="font-semibold">¿Cómo ver el efecto?</p>
            <p>
              Los cambios aplican a los usuarios de <strong>{clinicName}</strong> la próxima vez que carguen una
              página. {superadminIsMember
                ? "Para verlo con tu cuenta, cambiá la clínica activa a esta desde el selector de clínica."
                : "Tu cuenta Superadmin no es miembro de esta clínica, así que tu panel no cambia: iniciá sesión (en otra ventana privada) con un usuario de la clínica."}
            </p>
            {members.length > 0 ? (
              <p className="mt-1 text-xs">
                Usuarios de la clínica: {members.map((m) => `${m.fullName} (${m.role})`).join(", ")}
              </p>
            ) : (
              <p className="mt-1 text-xs">Esta clínica todavía no tiene usuarios activos: invitá uno desde Equipo.</p>
            )}
          </div>

          <Card
            title={`Nivel clínica · ${clinicName ?? ""}`}
            description="Override para toda la clínica. «Heredar default» mantiene el comportamiento actual."
          >
            <SuperadminCustomizationsTable
              clinicId={clinicId}
              userId={null}
              scope="clinic"
              available={state.available}
              rows={buildRows("clinic", state.clinicRows, state.clinicResolved, products)}
            />
          </Card>

          {nationalRx ? (
            <Card
              title="Receta electrónica nacional"
              description="Estado de integración (preparado para ReNaPDiS). Detalle en ReNaPDiS Readiness."
            >
              <NationalRxReadinessCard readiness={nationalRx} />
            </Card>
          ) : null}

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
                  rows={buildRows("user", state.userRows, state.userResolved, products)}
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
