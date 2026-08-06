"use client";

import { Bot, KeyRound, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  disconnectClinicSharedAiAction,
  fetchClinicSharedAiConnectionAction,
  saveClinicSharedAiConnectionAction,
} from "@/lib/actions/clinic-shared-ai";
import {
  USER_AI_PROVIDER_OPTIONS,
  type UserAiConnectionPublic,
  type UserAiProviderId,
} from "@/lib/ai/user-ai-provider-types";

export function TeamSharedCredentialsPanel() {
  const [connection, setConnection] = useState<UserAiConnectionPublic | null>(null);
  const [provider, setProvider] = useState<UserAiProviderId>("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const providerMeta = USER_AI_PROVIDER_OPTIONS.find((p) => p.id === provider)!;

  useEffect(() => {
    void fetchClinicSharedAiConnectionAction().then((row) => {
      if (row) {
        setConnection(row);
        setProvider(row.provider);
        setModel(row.model);
        setBaseUrl(row.baseUrl ?? "");
        setLabel(row.label ?? "");
      }
    });
  }, []);

  function handleProviderChange(next: UserAiProviderId) {
    setProvider(next);
    const meta = USER_AI_PROVIDER_OPTIONS.find((p) => p.id === next)!;
    if (!model || USER_AI_PROVIDER_OPTIONS.some((p) => p.defaultModel === model)) {
      setModel(meta.defaultModel);
    }
    if (!baseUrl || USER_AI_PROVIDER_OPTIONS.some((p) => p.defaultBaseUrl === baseUrl)) {
      setBaseUrl(meta.defaultBaseUrl ?? "");
    }
  }

  function save() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await saveClinicSharedAiConnectionAction({
        provider,
        apiKey: apiKey.trim() || undefined,
        model: model.trim() || providerMeta.defaultModel,
        baseUrl: baseUrl.trim() || null,
        label: label.trim() || null,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      const refreshed = await fetchClinicSharedAiConnectionAction();
      setConnection(refreshed);
      setApiKey("");
      setSuccess(
        "Credenciales compartidas guardadas. Asignalas a cada miembro en la matriz de permisos."
      );
    });
  }

  function disconnect() {
    if (!confirm("¿Eliminar las credenciales compartidas del consultorio?")) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await disconnectClinicSharedAiAction();
      if (result.error) {
        setError(result.error);
        return;
      }
      setConnection(null);
      setApiKey("");
      setSuccess("Credenciales compartidas eliminadas.");
    });
  }

  return (
    <Card title="Credenciales compartidas del consultorio">
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-teal-100 bg-teal-50/80 p-3">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
        <p className="text-sm text-teal-900">
          Como administrador, configurá una sola API key de IA para el equipo. Luego activá{" "}
          <strong>IA compartida</strong> por usuario en la matriz de abajo. Quienes no la tengan
          activada pueden usar credenciales propias en Configuración → Asistente IA.
        </p>
      </div>

      {connection ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Conectado: {providerMeta.label} · {connection.model} · clave {connection.keyHint}
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {success}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Proveedor</span>
          <select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value as UserAiProviderId)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {USER_AI_PROVIDER_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Etiqueta (opcional)</span>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ej. Suscripción consultorio"
          />
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">
            API key {connection ? "(dejar vacío para mantener la actual)" : ""}
          </span>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={providerMeta.apiKeyPlaceholder ?? "sk-…"}
            autoComplete="off"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Modelo</span>
          <Input value={model} onChange={(e) => setModel(e.target.value)} />
        </label>

        {!providerMeta.hideBaseUrl ? (
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Base URL</span>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </label>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={save} loading={pending}>
          <Bot className="h-4 w-4" />
          Guardar credenciales compartidas
        </Button>
        {connection ? (
          <Button type="button" variant="outline" onClick={disconnect} loading={pending}>
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
