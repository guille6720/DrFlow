"use client";

import { Bot, KeyRound, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  disconnectUserAiAction,
  fetchUserAiConnectionAction,
  saveUserAiConnectionAction,
} from "@/lib/actions/user-ai-connection";
import {
  USER_AI_PROVIDER_OPTIONS,
  type UserAiConnectionPublic,
  type UserAiProviderId,
} from "@/lib/ai/user-ai-provider-types";

export function AiProviderPanel() {
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
    void fetchUserAiConnectionAction().then((row) => {
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
      const result = await saveUserAiConnectionAction({
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

      const refreshed = await fetchUserAiConnectionAction();
      setConnection(refreshed);
      setApiKey("");
      setSuccess("Conexión guardada. Tu clave queda almacenada de forma segura y no se muestra de nuevo.");
    });
  }

  function disconnect() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await disconnectUserAiAction();
      if (result.error) {
        setError(result.error);
        return;
      }
      setConnection(null);
      setApiKey("");
      setSuccess("Proveedor desconectado.");
    });
  }

  return (
    <Card
      title="Asistente IA"
      description="Conectá tu proveedor preferido (OpenAI, Anthropic u endpoint compatible). La API key se guarda en tu cuenta y solo se usa en el servidor para el copilot clínico."
    >
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-violet-100 bg-violet-50/80 px-3 py-2 text-sm text-violet-900">
        <Bot className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Bring your own key (BYOK): cada usuario elige su modelo. DrFlow no comparte tu clave con
          otros usuarios del consultorio.
        </p>
      </div>

      {connection ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-900">
          <p className="font-medium">Conectado</p>
          <p className="mt-1 text-xs">
            {USER_AI_PROVIDER_OPTIONS.find((p) => p.id === connection.provider)?.label} ·{" "}
            {connection.model} · clave {connection.keyHint}
          </p>
        </div>
      ) : null}

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      {success ? <p className="mb-3 text-sm text-emerald-700">{success}</p> : null}

      <div className="space-y-4">
        <div>
          <label htmlFor="ai-provider" className="text-sm font-medium text-slate-200">
            Proveedor
          </label>
          <select
            id="ai-provider"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={provider}
            disabled={pending}
            onChange={(e) => handleProviderChange(e.target.value as UserAiProviderId)}
          >
            {USER_AI_PROVIDER_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">{providerMeta.description}</p>
        </div>

        <div>
          <label htmlFor="ai-api-key" className="text-sm font-medium text-slate-200">
            <KeyRound className="mr-1 inline h-3.5 w-3.5" />
            API key
          </label>
          <Input
            id="ai-api-key"
            type="password"
            autoComplete="off"
            className="mt-1"
            placeholder={connection ? "Dejar vacío para mantener la clave actual" : "sk-…"}
            value={apiKey}
            disabled={pending}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="ai-model" className="text-sm font-medium text-slate-200">
            Modelo
          </label>
          <Input
            id="ai-model"
            className="mt-1"
            placeholder={providerMeta.defaultModel}
            value={model}
            disabled={pending}
            onChange={(e) => setModel(e.target.value)}
          />
        </div>

        {providerMeta.baseUrlRequired || provider !== "openai" ? (
          <div>
            <label htmlFor="ai-base-url" className="text-sm font-medium text-slate-200">
              URL base (opcional)
            </label>
            <Input
              id="ai-base-url"
              className="mt-1"
              placeholder={providerMeta.defaultBaseUrl ?? "https://…"}
              value={baseUrl}
              disabled={pending}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
        ) : null}

        <div>
          <label htmlFor="ai-label" className="text-sm font-medium text-slate-200">
            Etiqueta (opcional)
          </label>
          <Input
            id="ai-label"
            className="mt-1"
            placeholder="Ej: Mi Claude personal"
            value={label}
            disabled={pending}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={pending || (!connection && apiKey.trim().length < 8)} onClick={save}>
            {pending ? "Guardando…" : connection ? "Actualizar conexión" : "Conectar"}
          </Button>
          {connection ? (
            <Button type="button" variant="outline" disabled={pending} onClick={disconnect}>
              <Trash2 className="h-4 w-4" />
              Desconectar
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
