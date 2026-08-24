"use client";

import { Key, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AddonUpgradeNotice } from "@/core/components/entitlements/addon-upgrade-notice";
import { useCanUseFeature } from "@/core/components/entitlements/entitlements-provider";
import { FEATURES } from "@/core/entitlements/features";
import { PUBLIC_API_SCOPES } from "@/core/public-api/types";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  type ClinicApiKeyRow,
  createClinicApiKey,
  revokeClinicApiKey,
} from "@/lib/actions/public-api-keys";

type Props = {
  keys: ClinicApiKeyRow[];
};

const SCOPE_LABELS: Record<string, string> = {
  "appointments:read": "Turnos — lectura",
  "appointments:write": "Turnos — crear",
  "professionals:read": "Profesionales — lectura",
};

export function PublicApiKeysPanel({ keys }: Props) {
  const router = useRouter();
  const canUseApi = useCanUseFeature(FEATURES.API);
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading("create");
    setErr(null);
    setNewSecret(null);
    const result = await createClinicApiKey(new FormData(e.currentTarget));
    setLoading(null);
    if (result.error) setErr(result.error);
    else {
      setNewSecret(result.secret ?? null);
      e.currentTarget.reset();
      router.refresh();
    }
  }

  async function handleRevoke(id: string) {
    if (!window.confirm("¿Revocar esta clave? Las integraciones dejarán de funcionar.")) return;
    setLoading(id);
    const fd = new FormData();
    fd.set("id", id);
    const result = await revokeClinicApiKey(fd);
    setLoading(null);
    if (result.error) setErr(result.error);
    else router.refresh();
  }

  return (
    <Card title="API pública (integraciones)">
      <p className="mb-4 text-sm text-slate-600">
        Generá claves Bearer para sistemas externos (ERP, bots, kioscos). Autenticación:{" "}
        <code className="rounded bg-slate-100 px-1">Authorization: Bearer dfk_live_…</code>
      </p>

      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        <p className="font-semibold">Endpoints v1</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5">
          <li>GET /api/v1/appointments</li>
          <li>POST /api/v1/appointments</li>
          <li>GET /api/v1/appointments/:id</li>
          <li>GET /api/v1/professionals</li>
          <li>GET /api/v1/availability?professional_id=…</li>
        </ul>
      </div>

      {keys.length === 0 ? (
        <p className="mb-4 text-sm text-slate-500">Sin claves activas.</p>
      ) : (
        <ul className="mb-4 divide-y divide-slate-100 text-sm">
          {keys.map((key) => (
            <li key={key.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
              <div>
                <p className="font-medium text-slate-900">{key.name}</p>
                <p className="font-mono text-xs text-slate-500">{key.key_prefix}…</p>
                <p className="text-xs text-slate-600">
                  {(key.scopes ?? []).map((s) => SCOPE_LABELS[s] ?? s).join(" · ")}
                </p>
                {key.last_used_at ? (
                  <p className="text-xs text-slate-400">
                    Último uso: {new Date(key.last_used_at).toLocaleString("es-AR")}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                size="sm"
                variant="danger"
                loading={loading === key.id}
                onClick={() => handleRevoke(key.id)}
              >
                <Trash2 className="h-4 w-4" />
                Revocar
              </Button>
            </li>
          ))}
        </ul>
      )}

      {newSecret ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Copiá la clave ahora — no se volverá a mostrar:</p>
          <code className="mt-2 block break-all rounded bg-white p-2 text-xs">{newSecret}</code>
        </div>
      ) : null}

      {canUseApi ? (
      <form onSubmit={handleCreate} className="grid gap-3 border-t border-slate-200 pt-4">
        <Input name="name" label="Nombre de la integración" placeholder="Ej. Bot WhatsApp" required />
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Permisos (scopes)</legend>
          <div className="flex flex-wrap gap-3 text-sm">
            {PUBLIC_API_SCOPES.map((scope) => (
              <label key={scope} className="flex items-center gap-2">
                <input type="checkbox" name="scopes" value={scope} defaultChecked={scope !== "appointments:write"} />
                {SCOPE_LABELS[scope] ?? scope}
              </label>
            ))}
          </div>
        </fieldset>
        <Button type="submit" loading={loading === "create"}>
          <Key className="mr-1 h-4 w-4" />
          Generar clave
        </Button>
      </form>
      ) : (
        <div className="border-t border-slate-200 pt-4">
          <AddonUpgradeNotice feature={FEATURES.API} />
        </div>
      )}

      {err ? <p className="mt-3 text-sm text-red-700">{err}</p> : null}
    </Card>
  );
}
