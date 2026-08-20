"use client";

import { useState, useTransition } from "react";

import {
  ADMIN_ASSIGNABLE_PLAN_KEYS,
  ADMIN_OVERRIDE_FEATURE_KEYS,
  ADMIN_SUBSCRIPTION_STATUS_KEYS,
  type EntitlementsAdminClinicRow,
  type EntitlementsAdminOverrideRow,
} from "@/core/entitlements/admin-constants";
import { commercialFeatureLabel } from "@/core/entitlements/feature-labels";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  assignClinicPlanAction,
  clearFeatureOverrideAction,
  createFeatureOverrideAction,
  setClinicEntitlementStatusAction,
  setClinicEntitlementTrialEndAction,
} from "@/lib/actions/entitlements-admin";

export function EntitlementsAdminPanel({
  clinics,
  overrides,
}: {
  clinics: EntitlementsAdminClinicRow[];
  overrides: EntitlementsAdminOverrideRow[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onAssign(formData: FormData) {
    startTransition(async () => {
      const result = await assignClinicPlanAction(formData);
      setMessage(result.ok ? `Plan ${result.planKey} asignado.` : result.error);
    });
  }

  function onOverride(formData: FormData) {
    startTransition(async () => {
      const result = await createFeatureOverrideAction(formData);
      setMessage(result.ok ? "Override creado." : result.error);
    });
  }

  function onStatus(formData: FormData) {
    startTransition(async () => {
      const result = await setClinicEntitlementStatusAction(formData);
      setMessage(result.ok ? `Estado ${result.status} actualizado.` : result.error);
    });
  }

  function onTrialEnd(formData: FormData) {
    startTransition(async () => {
      const result = await setClinicEntitlementTrialEndAction(formData);
      setMessage(
        result.ok
          ? result.trialEndsAt
            ? `Prueba comercial hasta ${result.trialEndsAt.slice(0, 10)}.`
            : "Ventana de prueba comercial sin fecha (no vence sola)."
          : result.error
      );
    });
  }

  function onClear(formData: FormData) {
    startTransition(async () => {
      const result = await clearFeatureOverrideAction(formData);
      setMessage(result.ok ? "Override quitado." : result.error);
    });
  }

  return (
    <div className="space-y-6">
      {message ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          {message}
        </p>
      ) : null}

      <Card title="Consultorios" description="Asignación manual de plan comercial (incluye legacy).">
        {clinics.length === 0 ? (
          <p className="text-sm text-slate-600">
            No hay clínicas o el catálogo comercial todavía no está migrado (121–128).
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {clinics.map((clinic) => (
              <li key={clinic.clinicId} className="flex flex-wrap items-center gap-2 py-2">
                <span className="min-w-40 font-medium text-slate-900">{clinic.clinicName}</span>
                <span className="text-slate-500">
                  {clinic.planKey ?? "sin plan"} {clinic.status ? `(${clinic.status})` : ""}
                  {clinic.trialEndsAt ? ` · prueba ${clinic.trialEndsAt.slice(0, 10)}` : ""}
                  {clinic.usageAi != null || clinic.usageWhatsapp != null
                    ? ` · IA ${clinic.usageAi ?? 0} · WhatsApp ${clinic.usageWhatsapp ?? 0}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Asignar plan" description="Solo superadmin. No uses esto para onboarding automático.">
        <form action={onAssign} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Consultorio
            <select name="clinicId" required className="mt-1 w-full rounded-lg border px-3 py-2">
              {clinics.map((clinic) => (
                <option key={clinic.clinicId} value={clinic.clinicId}>
                  {clinic.clinicName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Plan
            <select name="planKey" required className="mt-1 w-full rounded-lg border px-3 py-2">
              {ADMIN_ASSIGNABLE_PLAN_KEYS.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </label>
          <label className="sm:col-span-2 text-sm">
            Motivo
            <input name="reason" className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <Button type="submit" disabled={pending || clinics.length === 0}>
            Asignar
          </Button>
        </form>
      </Card>

      <Card title="Override / add-on" description="Pro + IA, Basic + PAMI, cuota extra, acceso temporal.">
        <form action={onOverride} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Consultorio
            <select name="clinicId" required className="mt-1 w-full rounded-lg border px-3 py-2">
              {clinics.map((clinic) => (
                <option key={clinic.clinicId} value={clinic.clinicId}>
                  {clinic.clinicName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Feature
            <select name="featureKey" required className="mt-1 w-full rounded-lg border px-3 py-2">
              {ADMIN_OVERRIDE_FEATURE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {commercialFeatureLabel(key)} ({key})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Habilitado
            <select name="enabled" className="mt-1 w-full rounded-lg border px-3 py-2">
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </label>
          <label className="text-sm">
            Límite (opcional)
            <input name="limit" type="number" min={0} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="text-sm">
            Vence (opcional)
            <input name="endsAt" type="datetime-local" className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="text-sm">
            Motivo
            <input name="reason" className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <Button type="submit" disabled={pending || clinics.length === 0}>
            Crear override
          </Button>
        </form>

        {overrides.length > 0 ? (
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {overrides.map((row) => (
              <li
                key={`${row.clinicId}:${row.featureKey}`}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span className="text-slate-700">
                  <span className="font-medium text-slate-900">{row.clinicName}</span>
                  {" · "}
                  {commercialFeatureLabel(row.featureKey)} ({row.featureKey}){" "}
                  {row.enabled ? "on" : "off"}
                  {row.endsAt ? ` · vence ${row.endsAt.slice(0, 10)}` : ""}
                  {row.reason ? ` · ${row.reason}` : ""}
                </span>
                <form action={onClear}>
                  <input type="hidden" name="clinicId" value={row.clinicId} />
                  <input type="hidden" name="featureKey" value={row.featureKey} />
                  <Button type="submit" size="sm" variant="outline" disabled={pending}>
                    Quitar
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-xs text-slate-500">No hay overrides vigentes.</p>
        )}
      </Card>

      <Card
        title="Estado comercial"
        description="active/trialing reactivan extras. past_due / cancelled / expired los pausan. El clínico core sigue. No reemplaza Mercado Pago."
      >
        <form action={onStatus} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Consultorio
            <select name="clinicId" required className="mt-1 w-full rounded-lg border px-3 py-2">
              {clinics.map((clinic) => (
                <option key={clinic.clinicId} value={clinic.clinicId}>
                  {clinic.clinicName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Estado
            <select name="status" required className="mt-1 w-full rounded-lg border px-3 py-2">
              {ADMIN_SUBSCRIPTION_STATUS_KEYS.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </label>
          <label className="sm:col-span-2 text-sm">
            Motivo
            <input name="reason" className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <Button type="submit" disabled={pending || clinics.length === 0}>
            Actualizar estado
          </Button>
        </form>
      </Card>

      <Card
        title="Ventana de prueba comercial"
        description="Solo aplica a clinic_entitlement_subscriptions.trial_ends_at. Vacío = sin vencimiento automático. No cambia el trial de Mercado Pago (clinics.trial_ends_at)."
      >
        <form action={onTrialEnd} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Consultorio
            <select name="clinicId" required className="mt-1 w-full rounded-lg border px-3 py-2">
              {clinics.map((clinic) => (
                <option key={clinic.clinicId} value={clinic.clinicId}>
                  {clinic.clinicName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Vence (opcional)
            <input name="trialEndsAt" type="datetime-local" className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="sm:col-span-2 text-sm">
            Motivo
            <input name="reason" className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <Button type="submit" disabled={pending || clinics.length === 0}>
            Guardar ventana de prueba
          </Button>
        </form>
      </Card>
    </div>
  );
}
