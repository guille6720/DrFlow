"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  resetFeatureCustomizationAction,
  saveFeatureCustomizationAction,
} from "@/lib/actions/superadmin-customizations";

export type CustomizationSource = "user" | "clinic" | "default";

export interface CustomizationRowView {
  key: string;
  label: string;
  category: string;
  critical: boolean;
  gatedBy: string | null;
  configurable: boolean;
  configKeys: string[];
  defaultEnabled: boolean;
  defaultConfigJson: string;
  setting: { enabled: boolean | null; configJson: string | null } | null;
  effective: {
    enabled: boolean;
    source: CustomizationSource;
    configSource: CustomizationSource;
    configJson: string;
  };
}

const SOURCE_LABEL: Record<CustomizationSource, string> = {
  user: "USUARIO",
  clinic: "CLÍNICA",
  default: "DEFAULT",
};

const SOURCE_VARIANT: Record<CustomizationSource, "brand" | "info" | "default"> = {
  user: "brand",
  clinic: "info",
  default: "default",
};

type EnabledChoice = "inherit" | "on" | "off";

function toChoice(enabled: boolean | null | undefined): EnabledChoice {
  if (enabled === true) return "on";
  if (enabled === false) return "off";
  return "inherit";
}

export function SuperadminCustomizationsTable({
  clinicId,
  userId,
  scope,
  rows,
  available,
}: {
  clinicId: string;
  userId: string | null;
  scope: "clinic" | "user";
  rows: CustomizationRowView[];
  available: boolean;
}) {
  return (
    <div className="space-y-3">
      {!available ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Las tablas de personalización no están disponibles en esta base (migración
          20260928120000 pendiente). Se muestran los valores por defecto y no se pueden guardar
          cambios.
        </p>
      ) : null}
      {rows.map((row) => (
        <CustomizationRow
          key={`${scope}-${userId ?? "clinic"}-${row.key}`}
          clinicId={clinicId}
          userId={userId}
          scope={scope}
          row={row}
          disabled={!available || !row.configurable}
        />
      ))}
    </div>
  );
}

function CustomizationRow({
  clinicId,
  userId,
  scope,
  row,
  disabled,
}: {
  clinicId: string;
  userId: string | null;
  scope: "clinic" | "user";
  row: CustomizationRowView;
  disabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<EnabledChoice>(toChoice(row.setting?.enabled));
  const [configJson, setConfigJson] = useState(row.setting?.configJson ?? "");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState<"save" | "reset" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(kind: "save" | "reset", confirmed: boolean) {
    setMessage(null);
    setError(null);
    if (row.critical && !confirmed) {
      setConfirming(kind);
      return;
    }
    setConfirming(null);
    startTransition(async () => {
      const result =
        kind === "save"
          ? await saveFeatureCustomizationAction({
              clinicId,
              userId: scope === "user" ? userId : null,
              featureKey: row.key,
              enabled: choice === "inherit" ? null : choice === "on",
              configJson: configJson.trim() || null,
              reason,
              confirmCritical: confirmed,
            })
          : await resetFeatureCustomizationAction({
              clinicId,
              userId: scope === "user" ? userId : null,
              featureKey: row.key,
              reason,
              confirmCritical: confirmed,
            });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (kind === "reset") {
        setChoice("inherit");
        setConfigJson("");
      }
      setMessage(kind === "save" ? "Guardado y auditado." : "Restablecido al valor heredado.");
      router.refresh();
    });
  }

  const inheritLabel = scope === "user" ? "Heredar de la clínica" : "Heredar default";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {row.label}{" "}
            <span className="font-mono text-xs font-normal text-slate-500">{row.key}</span>
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {row.category} · default {row.defaultEnabled ? "ON" : "OFF"}
            {row.gatedBy ? ` · sigue sujeto a ${row.gatedBy}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {row.critical ? <Badge variant="warning">Crítico</Badge> : null}
          <Badge variant={row.effective.enabled ? "success" : "danger"}>
            {row.effective.enabled ? "Efectivo: ON" : "Efectivo: OFF"}
          </Badge>
          <Badge variant={SOURCE_VARIANT[row.effective.source]}>
            Origen: {SOURCE_LABEL[row.effective.source]}
          </Badge>
        </div>
      </div>

      {!row.configurable ? (
        <p className="mt-2 text-xs text-slate-500">
          {scope === "user"
            ? "No admite override por usuario."
            : "No se configura por clínica."}
        </p>
      ) : (
        <div className="mt-3 grid gap-2 md:grid-cols-[180px_1fr]">
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Estado
            <select
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              value={choice}
              disabled={disabled || pending}
              onChange={(e) => setChoice(e.target.value as EnabledChoice)}
            >
              <option value="inherit">{inheritLabel}</option>
              <option value="on">Activado</option>
              <option value="off">Desactivado</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Motivo (opcional, sin datos de pacientes)
            <input
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              value={reason}
              maxLength={500}
              disabled={disabled || pending}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {row.configKeys.length > 0 ? (
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 md:col-span-2">
              Configuración JSON (claves permitidas: {row.configKeys.join(", ")}) · efectiva (
              {SOURCE_LABEL[row.effective.configSource]}):{" "}
              <code className="font-mono text-[11px]">{row.effective.configJson}</code>
              <textarea
                className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                rows={3}
                placeholder={row.defaultConfigJson}
                value={configJson}
                disabled={disabled || pending}
                onChange={(e) => setConfigJson(e.target.value)}
              />
            </label>
          ) : null}
        </div>
      )}

      {row.configurable ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {confirming ? (
            <>
              <span className="text-xs font-medium text-amber-800 dark:text-amber-200">
                Cambio crítico: afecta el acceso de{" "}
                {scope === "user" ? "este usuario" : "toda la clínica"}. ¿Confirmás?
              </span>
              <Button
                type="button"
                size="sm"
                loading={pending}
                onClick={() => run(confirming, true)}
              >
                Confirmar
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setConfirming(null)}>
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                loading={pending}
                disabled={disabled}
                onClick={() => run("save", false)}
              >
                Guardar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={disabled || pending || !row.setting}
                onClick={() => run("reset", false)}
              >
                Restablecer
              </Button>
            </>
          )}
          {message ? <span className="text-xs text-teal-800 dark:text-teal-200">{message}</span> : null}
          {error ? <span className="text-xs text-red-700 dark:text-red-300">{error}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
