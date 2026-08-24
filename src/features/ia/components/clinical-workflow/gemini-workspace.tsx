"use client";

import { Bot, Clock3, Loader2, Send, Sparkles, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { CLINICAL_RESEARCH_PROTOCOLS_FLAG } from "@/core/compliance/clinical-research-ai";
import { SafeInternalLink } from "@/core/components/safe-link";

import { useClinicalCopilotChat } from "@/features/ia/hooks/use-clinical-copilot-chat";
import {
  clearGeminiWorkspaceSnapshot,
  type GeminiSearchHistoryEntry,
  loadGeminiWorkspaceSnapshot,
  saveGeminiWorkspaceSnapshot,
  upsertGeminiSearchHistory,
} from "@/features/ia/lib/gemini-workspace-persistence";
import { PHYSICIAN_ASSIST_DISCLAIMER } from "@/features/ia/types/physician-assist-types";
import {
  PatientSearchCombobox,
  type PatientSearchOption,
} from "@/features/pacientes/components/pacientes/patient-search-combobox";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";
import { useFeatureFlag } from "@/features/plugins/components/plugins/clinic-features-provider";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { GeminiStatsPatient } from "@/lib/ai/gemini-structured-response";
import type { ClinicalCopilotContext } from "@/lib/utils/clinical-copilot";

const STATS_SUGGESTED_PROMPTS = [
  "¿Cuántos pacientes con hipertensión hay en DrFlow?",
  "Pacientes con asma o EPOC",
  "Diagnósticos más frecuentes este mes",
];

const RESEARCH_SUGGESTED_PROMPTS = [
  "Candidatos para MARITIME-CV",
  "Criterios del estudio PRESTO (EPOC)",
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

function formatHistoryTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PatientResultsList({
  patients,
  title,
}: {
  patients: GeminiStatsPatient[];
  title?: string;
}) {
  if (patients.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-slate-700">
        {title ?? `Pacientes (${patients.length})`}
      </p>
      <ul className="mt-1 space-y-1">
        {patients.map((item) => (
          <li key={item.id}>
            <SafeInternalLink
              href={buildPatientWorkspaceUrl(item.id)}
              target="_blank"
              rel="noopener noreferrer"
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
      <p className="mt-1 text-[10px] text-slate-500">
        Se abre en otra pestaña: al volver a Gemini seguís viendo el listado.
      </p>
    </div>
  );
}

export function GeminiWorkspace() {
  const enabled = useFeatureFlag("consultation_assistant");
  const researchEnabled = useFeatureFlag(CLINICAL_RESEARCH_PROTOCOLS_FLAG);
  const suggestedPrompts = useMemo(
    () =>
      researchEnabled
        ? [...STATS_SUGGESTED_PROMPTS, ...RESEARCH_SUGGESTED_PROMPTS]
        : STATS_SUGGESTED_PROMPTS,
    [researchEnabled]
  );
  const [patient, setPatient] = useState<PatientSearchOption | null>(null);
  const snapshot = useMemo(() => loadGeminiWorkspaceSnapshot(), []);
  const [searchHistory, setSearchHistory] = useState<GeminiSearchHistoryEntry[]>(
    () => snapshot.searchHistory
  );
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(
    () => snapshot.activeHistoryId
  );
  const hydratedQueryIds = useRef(
    new Set(
      snapshot.searchHistory.map(
        (entry) => `${entry.query}::${entry.patients.map((p) => p.id).join(",")}`
      )
    )
  );
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const context = useMemo((): ClinicalCopilotContext => {
    if (!patient) return {};
    return {
      patientId: patient.id,
      patientName: `${patient.last_name}, ${patient.first_name}`,
    };
  }, [patient]);

  const { turns, input, setInput, submit, loading, meta, hasLlm, reset } = useClinicalCopilotChat(
    context,
    { initialTurns: snapshot.turns }
  );

  const activeHistory = searchHistory.find((item) => item.id === activeHistoryId) ?? null;

  useEffect(() => {
    saveGeminiWorkspaceSnapshot({
      turns,
      searchHistory,
      activeHistoryId,
    });
  }, [turns, searchHistory, activeHistoryId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, loading]);

  if (!enabled) {
    return (
      <p className="text-sm text-slate-700">
        Activá el asistente de consulta en configuración para usar Gemini dentro de DrFlow.
      </p>
    );
  }

  function rememberSearch(query: string, response: Awaited<ReturnType<typeof submit>>) {
    const patients = response?.structured?.patients ?? [];
    if (patients.length === 0) return;
    const key = `${query}::${patients.map((p) => p.id).join(",")}`;
    if (hydratedQueryIds.current.has(key)) return;
    hydratedQueryIds.current.add(key);
    setSearchHistory((prev) => {
      const next = upsertGeminiSearchHistory(prev, {
        query,
        patientCount: patients.length,
        patients,
        summary: response?.structured?.summary,
      });
      setActiveHistoryId(next[0]?.id ?? null);
      return next;
    });
  }

  async function runQuery(message: string) {
    const trimmed = message.trim();
    if (!trimmed) return;
    const response = await submit(trimmed);
    rememberSearch(trimmed, response);
  }

  function clearAll() {
    reset();
    setSearchHistory([]);
    setActiveHistoryId(null);
    clearGeminiWorkspaceSnapshot();
    hydratedQueryIds.current.clear();
  }

  function rerunHistory(entry: GeminiSearchHistoryEntry) {
    setActiveHistoryId(entry.id);
    void runQuery(entry.query);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-800">
              Historial de búsqueda
            </p>
            {searchHistory.length > 0 ? (
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-800"
                title="Limpiar historial y chat"
              >
                <Trash2 className="h-3 w-3" />
                Limpiar
              </button>
            ) : null}
          </div>

          {searchHistory.length === 0 ? (
            <p className="text-xs leading-relaxed text-slate-600">
              Acá van a aparecer tus búsquedas con listados (ej. bronquiectasias). Tocá una para
              volver a ver los pacientes sin perder el hilo.
            </p>
          ) : (
            <ul className="max-h-56 space-y-1.5 overflow-y-auto">
              {searchHistory.map((entry) => {
                const active = entry.id === activeHistoryId;
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => setActiveHistoryId(entry.id)}
                      className={
                        active
                          ? "w-full rounded-xl border border-teal-200 bg-teal-50 px-2.5 py-2 text-left"
                          : "w-full rounded-xl border border-transparent px-2.5 py-2 text-left hover:bg-slate-50"
                      }
                    >
                      <p className="line-clamp-2 text-xs font-medium text-slate-800">{entry.query}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                        <span className="inline-flex items-center gap-0.5">
                          <Users className="h-3 w-3" />
                          {entry.patientCount}
                        </span>
                        <span className="inline-flex items-center gap-0.5">
                          <Clock3 className="h-3 w-3" />
                          {formatHistoryTime(entry.at)}
                        </span>
                      </p>
                    </button>
                    {active ? (
                      <div className="mt-1 flex gap-1 px-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 flex-1 text-[10px]"
                          disabled={loading}
                          onClick={() => rerunHistory(entry)}
                        >
                          Buscar de nuevo
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {activeHistory && activeHistory.patients.length > 0 ? (
          <div className="rounded-2xl border border-teal-100 bg-teal-50/40 p-4 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-900">
              Resultados guardados
            </p>
            <p className="mb-2 line-clamp-2 text-[11px] text-teal-900/80">{activeHistory.query}</p>
            <div className="max-h-64 overflow-y-auto pr-1">
              <PatientResultsList patients={activeHistory.patients} />
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-800">
            Paciente (HC)
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
            Opcional: elegí un paciente solo si querés preguntar sobre su HC. Las búsquedas del
            consultorio no lo necesitan.
          </p>
        </div>
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
                {researchEnabled
                  ? "Preguntá estadísticas o candidatos a protocolos (flag de investigación activo). Los resultados quedan guardados acá y en el historial de la izquierda."
                  : "Preguntá estadísticas del consultorio. El matching de candidatos a protocolos de investigación está desactivado hasta revisión legal/privacidad."}
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={loading}
                    onClick={() => void runQuery(prompt)}
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
                    <PatientResultsList patients={turn.response.structured.patients} />
                  ) : null}
                </div>
              ) : turn.role === "assistant" && turn.response ? (
                <pre className="whitespace-pre-wrap font-sans">{turn.response.body}</pre>
              ) : (
                turn.text
              )}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void runQuery(input);
          }}
        >
          <Textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ej: cuantos pacientes hay con Bronquiectasias"
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
