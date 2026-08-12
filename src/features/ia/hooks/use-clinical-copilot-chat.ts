"use client";

import { useCallback, useEffect, useState } from "react";

import type { UserAiConnectionPublic } from "@/lib/ai/user-ai-provider-types";
import type { ClinicalCopilotContext } from "@/lib/utils/clinical-copilot";
import type { OrchestratedCopilotResponse } from "@/lib/utils/clinical-copilot";
import { runClinicalCopilotQuery } from "@/lib/utils/clinical-copilot";

export type CopilotChatTurn = {
  role: "user" | "assistant";
  text: string;
  response?: OrchestratedCopilotResponse;
  pending?: boolean;
  error?: string;
};

type ClinicalAiMeta = {
  llmConfigured: boolean;
  vertexConfigured?: boolean;
  geminiConfigured?: boolean;
  userConnection: UserAiConnectionPublic | null;
};

function toChatHistory(turns: CopilotChatTurn[]) {
  return turns
    .filter((t) => !t.pending && !t.error)
    .map((t) => ({
      role: t.role,
      content: t.role === "assistant" ? (t.response?.body ?? t.text) : t.text,
    }));
}

/** Conversational copilot — API when LLM available, local rule-based fallback. */
export function useClinicalCopilotChat(context: ClinicalCopilotContext) {
  const [turns, setTurns] = useState<CopilotChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<ClinicalAiMeta>({ llmConfigured: false, userConnection: null });

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/clinical-ai")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ClinicalAiMeta | null) => {
        if (!cancelled && data) {
          setMeta({
            llmConfigured: Boolean(data.llmConfigured),
            vertexConfigured: Boolean(data.vertexConfigured),
            geminiConfigured: Boolean(data.geminiConfigured),
            userConnection: data.userConnection ?? null,
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const hasLlm = Boolean(
    meta.userConnection || meta.llmConfigured || meta.vertexConfigured || meta.geminiConfigured
  );

  const submit = useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (!trimmed || loading) return;

      const history = toChatHistory(turns);
      setTurns((prev) => [
        ...prev,
        { role: "user", text: trimmed },
        { role: "assistant", text: "", pending: true },
      ]);
      setInput("");
      setLoading(true);

      try {
        const res = await fetch("/api/clinical-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task: "copilot_query",
            message: trimmed,
            chatHistory: history,
            useUserProvider: true,
            patientId: context.patientId,
            patientName: context.patientName,
            lastConsultAt: context.lastConsultAt,
            copilotContext: context,
            chart: context.chart,
            assistContext: context.assistContext,
          }),
        });

        if (!res.ok) {
          throw new Error("No se pudo contactar al asistente");
        }

        const json = (await res.json()) as { result: OrchestratedCopilotResponse };
        const response: OrchestratedCopilotResponse = {
          intent: json.result.intent ?? "help",
          title: json.result.title,
          body: json.result.body,
          actions: json.result.actions ?? [],
          agentId: json.result.agentId,
          engine: json.result.engine,
          structured: json.result.structured,
        };

        setTurns((prev) => {
          const next = [...prev];
          const idx = next.findIndex((t) => t.pending);
          if (idx >= 0) {
            next[idx] = { role: "assistant", text: response.body, response };
          }
          return next;
        });
      } catch {
        const fallback = runClinicalCopilotQuery(trimmed, context);
        setTurns((prev) => {
          const next = [...prev];
          const idx = next.findIndex((t) => t.pending);
          if (idx >= 0) {
            next[idx] = {
              role: "assistant",
              text: fallback.body,
              response: fallback,
              error: "Respuesta local (sin conexión al modelo)",
            };
          }
          return next;
        });
      } finally {
        setLoading(false);
      }
    },
    [context, loading, turns]
  );

  const reset = useCallback(() => setTurns([]), []);

  return {
    turns,
    input,
    setInput,
    submit,
    loading,
    meta,
    hasLlm,
    reset,
  };
}
