"use client";

import { useMemo, useState } from "react";
import { Copy, Send, Building2 } from "lucide-react";
import Link from "next/link";
import { PatientWorkspaceOverlay } from "@/components/pacientes/workspace/patient-workspace-overlay";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useFeatureFlag } from "@/components/plugins/clinic-plugins-provider";
import {
  buildAdminOpsSuggestedPrompts,
} from "@/lib/utils/admin-ops-assistant";
import {
  runAdminOpsOrchestrator,
  ADMIN_OPS_AGENT_LABELS,
  type AdminOpsOrchestratorResult,
} from "@/lib/utils/admin-ops-orchestrator";
import type { AdminOpsContext } from "@/lib/utils/admin-ops-types";
import { ADMIN_OPS_DISCLAIMER } from "@/lib/utils/admin-ops-assistant";

type Props = {
  open: boolean;
  onClose: () => void;
  context: AdminOpsContext;
};

type ChatTurn = {
  role: "user" | "assistant";
  text: string;
  response?: AdminOpsOrchestratorResult;
};

/** Conversational admin/ops assistant — rule-based (Phase G). */
export function AdminOpsCopilotSheet({ open, onClose, context }: Props) {
  const enabled = useFeatureFlag("admin_ops_assistant");
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [copied, setCopied] = useState(false);

  const prompts = useMemo(() => buildAdminOpsSuggestedPrompts(context), [context]);

  function submit(message: string) {
    const trimmed = message.trim();
    if (!trimmed) return;

    const response = runAdminOpsOrchestrator({
      task: "admin_ops_query",
      message: trimmed,
      context,
    });
    setTurns((prev) => [
      ...prev,
      { role: "user", text: trimmed },
      { role: "assistant", text: response.body, response },
    ]);
    setInput("");
  }

  async function copyText(text: string) {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const subtitle =
    context.page === "dashboard"
      ? "Dashboard operativo"
      : context.page === "caja"
        ? "Caja"
        : context.page === "waiting_room"
          ? "Sala de espera"
          : "Operaciones del consultorio";

  return (
    <PatientWorkspaceOverlay
      open={open}
      title="Asistente operativo"
      subtitle={subtitle}
      onClose={onClose}
      wide
    >
      {enabled ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-teal-900">
              <Building2 className="h-4 w-4" />
              Secretaría y operaciones
            </div>
            <p className="text-xs text-teal-800">{ADMIN_OPS_DISCLAIMER}</p>
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
                    className="rounded-full border border-teal-200 bg-white px-3 py-1 text-xs text-teal-900 hover:bg-teal-50"
                    onClick={() => submit(prompt)}
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
                    : "mr-4 rounded-lg border border-teal-100 bg-teal-50/40 px-3 py-2 text-sm text-slate-800"
                }
              >
                {turn.role === "assistant" && turn.response ? (
                  <>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-teal-700">
                      {turn.response.title}
                    </p>
                    <p className="mb-1 text-[10px] text-teal-600">
                      Agente: {ADMIN_OPS_AGENT_LABELS[turn.response.agentId]} · rule-based
                    </p>
                    <pre className="whitespace-pre-wrap font-sans">{turn.response.body}</pre>
                    {turn.response.actions.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {turn.response.actions.map((action) =>
                          action.href ? (
                            <Link key={action.label} href={action.href} onClick={onClose}>
                              <Button type="button" size="sm" variant="outline">
                                {action.label}
                              </Button>
                            </Link>
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
              submit(input);
            }}
          >
            <Textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ej: Resumen del día"
              className="flex-1"
              voiceInput
            />
            <Button type="submit" disabled={!input.trim()} aria-label="Enviar">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      ) : (
        <p className="text-sm text-slate-600">
          Activá el asistente operativo en configuración para usar esta función.
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
        {copied ? <span className="self-center text-xs text-emerald-700">Copiado</span> : null}
      </div>
    </PatientWorkspaceOverlay>
  );
}
