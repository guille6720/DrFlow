"use client";

import { Bot, Copy, Loader2, Send, Settings, Sparkles } from "lucide-react";
import { useMemo } from "react";

import { SafeInternalLink } from "@/core/components/safe-link";
import { toast } from "@/core/notifications/toast";

import { useClinicalCopilotChat } from "@/features/ia/hooks/use-clinical-copilot-chat";
import { PHYSICIAN_ASSIST_DISCLAIMER } from "@/features/ia/types/physician-assist-types";
import { PatientWorkspaceOverlay } from "@/features/pacientes/components/pacientes/workspace/patient-workspace-overlay";
import { useFeatureFlag } from "@/features/plugins/components/plugins/clinic-features-provider";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { USER_AI_PROVIDER_OPTIONS } from "@/lib/ai/user-ai-provider-types";
import { CLINICAL_AI_AGENT_LABELS } from "@/lib/utils/clinical-ai-orchestrator";
import type { ClinicalCopilotContext } from "@/lib/utils/clinical-copilot";
import { buildCopilotSuggestedPrompts } from "@/lib/utils/clinical-copilot";

type Props = {
  open: boolean;
  onClose: () => void;
  context: ClinicalCopilotContext;
};

/** Conversational clinical copilot — LLM when configured, rule-based fallback. */
export function ClinicalCopilotSheet({ open, onClose, context }: Props) {
  const enabled = useFeatureFlag("consultation_assistant");
  const { turns, input, setInput, submit, loading, meta, hasLlm } = useClinicalCopilotChat(context);

  const prompts = useMemo(() => buildCopilotSuggestedPrompts(context), [context]);

  async function copyText(text: string) {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(text);
    toast.copySuccess();
  }

  const subtitle = context.patientName ?? "Sin paciente activo";
  const providerLabel = meta.userConnection
    ? USER_AI_PROVIDER_OPTIONS.find((p) => p.id === meta.userConnection!.provider)?.label ??
      meta.userConnection.provider
    : meta.llmConfigured
      ? "Plataforma"
      : null;

  return (
    <PatientWorkspaceOverlay
      open={open}
      title="Copilot clínico"
      subtitle={subtitle}
      onClose={onClose}
      wide
    >
      {enabled ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sm font-medium text-violet-900">
                <Sparkles className="h-4 w-4" />
                Asistente conversacional
              </div>
              {providerLabel ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-white px-2 py-0.5 text-[10px] font-medium text-violet-800">
                  <Bot className="h-3 w-3" />
                  {providerLabel}
                  {meta.userConnection ? ` · ${meta.userConnection.model}` : ""}
                </span>
              ) : (
                <SafeInternalLink
                  href="/configuracion?grupo=sistema&seccion=asistente-ia"
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-700 underline-offset-2 hover:underline"
                  onClick={onClose}
                >
                  <Settings className="h-3 w-3" />
                  Conectar tu IA
                </SafeInternalLink>
              )}
            </div>
            <p className="text-xs text-violet-800">{PHYSICIAN_ASSIST_DISCLAIMER}</p>
            {!hasLlm ? (
              <p className="mt-2 text-xs text-violet-700">
                Modo local (sin modelo). Configurá OpenAI, Anthropic, Gemini u otro proveedor en{" "}
                <SafeInternalLink
                  href="/configuracion?grupo=sistema&seccion=asistente-ia"
                  className="font-medium underline underline-offset-2"
                  onClick={onClose}
                >
                  Asistente IA
                </SafeInternalLink>{" "}
                para respuestas generativas.
              </p>
            ) : null}
          </div>

          {turns.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Sugerencias
              </p>
              <div className="flex flex-wrap gap-2">
                {prompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs text-violet-900 hover:bg-violet-50 disabled:opacity-50"
                    disabled={loading}
                    onClick={() => void submit(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-lg border border-slate-100 bg-white p-3">
            {turns.map((turn, index) => (
              <div
                key={`${turn.role}-${index}`}
                className={
                  turn.role === "user"
                    ? "ml-8 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800"
                    : "mr-4 rounded-lg border border-violet-100 bg-violet-50/40 px-3 py-2 text-sm text-slate-800"
                }
              >
                {turn.role === "assistant" && turn.pending ? (
                  <div className="flex items-center gap-2 text-violet-700">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs">Pensando…</span>
                  </div>
                ) : turn.role === "assistant" && turn.response ? (
                  <>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-violet-700">
                      {turn.response.title}
                    </p>
                    {turn.response.agentId ? (
                      <p className="mb-1 text-[10px] text-violet-600">
                        Agente: {CLINICAL_AI_AGENT_LABELS[turn.response.agentId]}
                        {turn.response.engine === "vertex_gemini"
                          ? " · Vertex Gemini"
                          : turn.response.engine === "gemini_api"
                            ? " · Gemini"
                            : turn.response.engine === "llm_enhanced"
                              ? " · LLM"
                              : " · rule-based"}
                      </p>
                    ) : null}
                    {turn.error ? (
                      <p className="mb-1 text-[10px] text-amber-700">{turn.error}</p>
                    ) : null}
                    <pre className="whitespace-pre-wrap font-sans">{turn.response.body}</pre>
                    {turn.response.actions.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {turn.response.actions.map((action) =>
                          action.href ? (
                            <SafeInternalLink key={action.label} href={action.href} onClick={onClose}>
                              <Button type="button" size="sm" variant="outline">
                                {action.label}
                              </Button>
                            </SafeInternalLink>
                          ) : action.copyText ? (
                            <Button
                              key={action.label}
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void copyText(action.copyText!)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              {action.label}
                            </Button>
                          ) : null
                        )}
                      </div>
                    ) : null}
                  </>
                ) : (
                  turn.text
                )}
              </div>
            ))}
          </div>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void submit(input);
            }}
          >
            <Textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ej: Mostrame las últimas tres consultas"
              className="flex-1"
              voiceInput
              disabled={loading}
            />
            <Button type="submit" disabled={!input.trim() || loading} aria-label="Enviar">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      ) : (
        <p className="text-sm text-slate-600">
          Activá el asistente de consulta en configuración para usar el copilot clínico.
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </PatientWorkspaceOverlay>
  );
}
