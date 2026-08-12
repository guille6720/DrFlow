"use client";

import { Bot, ExternalLink, KeyRound, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { SafeInternalLink } from "@/core/components/safe-link";

import { GEMINI_IN_APP_HREF } from "@/features/ia/constants/gemini-web-app";

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
      description="Conectá tu proveedor preferido (OpenAI, Anthropic, Google Gemini u endpoint compatible). La API key se guarda en tu cuenta y solo se usa en el servidor para el copilot clínico."
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
          <p className="mt-2 text-xs text-emerald-800">
            La clave ya está guardada. El chat no se abre acá: entrá a{" "}
            <strong>Gemini</strong> en el menú izquierdo.
          </p>
          <SafeInternalLink href={GEMINI_IN_APP_HREF} className="mt-3 inline-flex">
            <Button type="button" size="sm">
              <Sparkles className="h-4 w-4" />
              Abrir Gemini
            </Button>
          </SafeInternalLink>
        </div>
      ) : null}

      {error ? (
        <div className="mb-3 space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p>{error}</p>
          {error.includes("migración 069") ? (
            <p className="text-xs text-red-700">
              En Supabase → SQL Editor, ejecutá el archivo{" "}
              <code className="rounded bg-red-100 px-1">069_user_ai_gemini_provider.sql</code> del
              repo, o pedile a soporte que corra{" "}
              <code className="rounded bg-red-100 px-1">npx supabase db push</code>.
            </p>
          ) : null}
        </div>
      ) : null}
      {success ? <p className="mb-3 text-sm text-emerald-700">{success}</p> : null}

      <div className="space-y-4">
        <div>
          <label htmlFor="ai-provider" className="text-sm font-medium text-slate-700">
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
          <label htmlFor="ai-api-key" className="text-sm font-medium text-slate-700">
            <KeyRound className="mr-1 inline h-3.5 w-3.5" />
            API key
          </label>
          {providerMeta.apiKeyHelpUrl ? (
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <p className="text-xs font-medium text-slate-800">Conectar tu Gemini personal</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-slate-600">
                <li>Abrí Google AI Studio con el botón de abajo e iniciá sesión con tu cuenta Google.</li>
                <li>Creá una API key (plan gratuito disponible).</li>
                <li>Copiá la clave y pegala en el campo «API key».</li>
                <li>Guardá con «Conectar» y abrí <strong>Gemini</strong> en el menú izquierdo.</li>
              </ol>
              <a
                href={providerMeta.apiKeyHelpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
              >
                <GoogleMark />
                Abrir Google AI Studio
                <ExternalLink className="h-3 w-3 opacity-60" />
              </a>
              <p className="mt-2 text-[11px] text-slate-500">
                No es login de DrFlow: es la clave de tu cuenta Google para consultas con Gemini.
              </p>
            </div>
          ) : null}
          <Input
            id="ai-api-key"
            type="password"
            autoComplete="off"
            className="mt-1"
            placeholder={
              connection
                ? "Dejar vacío para mantener la clave actual"
                : (providerMeta.apiKeyPlaceholder ?? "sk-…")
            }
            value={apiKey}
            disabled={pending}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="ai-model" className="text-sm font-medium text-slate-700">
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

        {!providerMeta.hideBaseUrl && (providerMeta.baseUrlRequired || provider !== "openai") ? (
          <div>
            <label htmlFor="ai-base-url" className="text-sm font-medium text-slate-700">
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
          <label htmlFor="ai-label" className="text-sm font-medium text-slate-700">
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

function GoogleMark() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
