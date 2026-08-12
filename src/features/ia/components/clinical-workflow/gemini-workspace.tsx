"use client";

import { Bot, Loader2, Send, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { SafeInternalLink } from "@/core/components/safe-link";

import { useClinicalCopilotChat } from "@/features/ia/hooks/use-clinical-copilot-chat";
import { PHYSICIAN_ASSIST_DISCLAIMER } from "@/features/ia/types/physician-assist-types";
import {
  PatientSearchCombobox,
  type PatientSearchOption,
} from "@/features/pacientes/components/pacientes/patient-search-combobox";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";
import { useFeatureFlag } from "@/features/plugins/components/plugins/clinic-features-provider";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ClinicalCopilotContext } from "@/lib/utils/clinical-copilot";

const SUGGESTED_PROMPTS = [
  "¿Cuántos pacientes con hipertensión hay en DrFlow?",
  "Candidatos para MARITIME-CV",
  "Criterios del estudio PRESTO (EPOC)",
  "Pacientes con asma o EPOC",
  "Diagnósticos más frecuentes este mes",
];

function engineLabel(
  engine?: string,
  meta?: {
    llmConfigured?: boolean;
    vertexConfigured?: boolean;
    geminiConfigured?: boolean;
    userConnection?: { provider?: string } | null;
  }
) {
  if (engine === "vertex_gemini") return "Vertex AI · Gemini";
  if (engine === "gemini_api") return "Gemini API";
  if (engine === "llm_enhanced") return "LLM";
  if (meta?.vertexConfigured) return "Vertex AI · Gemini";
  if (meta?.geminiConfigured || meta?.userConnection?.provider === "gemini") return "Gemini API";
  if (meta?.userConnection || meta?.llmConfigured) return "LLM";
  return "Sin modelo";
}

export function GeminiWorkspace() {
  const enabled = useFeatureFlag("consultation_assistant");
  const [patient, setPatient] = useState<PatientSearchOption | null>(null);

  const context = useMemo((): ClinicalCopilotContext => {
    if (!patient) return {};
    return {
      patientId: patient.id,
      patientName: `${patient.last_name}, ${patient.first_name}`,
    };
  }, [patient]);

  const { turns, input, setInput, submit, loading, meta, hasLlm, reset } = useClinicalCopilotChat(context);

  useEffect(() => {
    reset();
  }, [patient?.id, reset]);

  if (!enabled) {
    return (
      <p className="text-sm text-slate-700">
        Activá el asistente de consulta en configuración para usar Gemini dentro de DrFlow.
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-800">
          Paciente
        </p>
        <PatientSearchCombobox
          patients={patient ? [patient] : []}
          label="Historia clínica"
          searchMode="remote"
          defaultPatientId={patient?.id}
          onPatientChange={(_id, picked) => setPatient(picked ?? null)}
          placeholder="Buscar paciente…"
        />
        <p className="mt-3 text-xs leading-relaxed text-slate-600">
          Para estadísticas del consultorio no hace falta elegir paciente. Para un resumen de HC,
          buscalo acá. El backend cuenta atenciones reales; Gemini no inventa listados.
        </p>
      </aside>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 rounded-xl border border-violet-100 bg-violet-50/70 p-3">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-violet-950">
              <Sparkles className="h-4 w-4" />
              Gemini en DrFlow
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-white px-2 py-0.5 text-[10px] font-medium text-violet-800">
              <Bot className="h-3 w-3" />
              {hasLlm ? engineLabel(undefined, meta) : "Sin modelo"}
            </span>
          </div>
          <p className="text-xs text-violet-900">{PHYSICIAN_ASSIST_DISCLAIMER}</p>
          {!hasLlm ? (
            <p className="mt-2 text-xs text-violet-800">
              Configurá Vertex AI o una API key de Gemini en el servidor, o conectá Gemini en{" "}
              <SafeInternalLink
                href="/configuracion?grupo=sistema&seccion=asistente-ia"
                className="font-medium underline underline-offset-2"
              >
                Asistente IA
              </SafeInternalLink>
              .
            </p>
          ) : null}
        </div>

        <div className="mb-4 max-h-[28rem] space-y-3 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/60 p-3">
          {turns.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                {patient
                  ? "Preguntá sobre la historia clínica o sobre estadísticas del consultorio."
                  : "Preguntá estadísticas del mes o elegí un paciente para usar su HC."}
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={loading}
                    onClick={() => void submit(prompt)}
                    className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-medium text-violet-800 hover:bg-violet-50 disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {turns.map((turn, index) => (
            <div
              key={`${turn.role}-${index}`}
              className={
                turn.role === "user"
                  ? "ml-8 rounded-lg bg-white px-3 py-2 text-sm text-slate-800 ring-1 ring-slate-200"
                  : "mr-4 rounded-lg border border-violet-100 bg-white px-3 py-2 text-sm text-slate-800"
              }
            >
              {turn.role === "assistant" && turn.pending ? (
                <div className="flex items-center gap-2 text-violet-700">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">Consultando Gemini…</span>
                </div>
              ) : turn.role === "assistant" && turn.response?.structured ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                    {engineLabel(turn.response.engine, meta)}
                  </p>
                  <p className="whitespace-pre-wrap">{turn.response.structured.summary}</p>
                  {turn.response.structured.findings.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold text-slate-700">Hallazgos</p>
                      <ul className="list-disc pl-4 text-sm">
                        {turn.response.structured.findings.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {turn.response.structured.suggestions.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold text-slate-700">Sugerencias</p>
                      <ul className="list-disc pl-4 text-sm">
                        {turn.response.structured.suggestions.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {turn.response.structured.warnings.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold text-amber-800">Alertas</p>
                      <ul className="list-disc pl-4 text-sm text-amber-900">
                        {turn.response.structured.warnings.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {turn.response.structured.patients &&
                  turn.response.structured.patients.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold text-slate-700">
                        Pacientes ({turn.response.structured.patients.length})
                      </p>
                      <ul className="mt-1 space-y-1">
                        {turn.response.structured.patients.map((item) => (
                          <li key={item.id}>
                            <SafeInternalLink
                              href={buildPatientWorkspaceUrl(item.id)}
                              className="text-sm font-medium text-teal-800 underline-offset-2 hover:underline"
                            >
                              {item.name}
                            </SafeInternalLink>
                            <span className="text-xs text-slate-600">
                              {item.date ? ` · ${item.date}` : ""}
                              {item.diagnosis ? ` — ${item.diagnosis}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : turn.role === "assistant" && turn.response ? (
                <pre className="whitespace-pre-wrap font-sans">{turn.response.body}</pre>
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
            placeholder={
              patient
                ? "Ej: Resumen de las últimas evoluciones y alertas"
                : "Ej: ¿Cuántos pacientes con hipertensión se atendieron este mes?"
            }
            className="flex-1"
            voiceInput
            disabled={loading}
          />
          <Button type="submit" disabled={!input.trim() || loading} aria-label="Enviar">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </section>
    </div>
  );
}
