"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Activity,
  CalendarDays,
  ChevronRight,
  FileStack,
  Pill,
  Printer,
  Search,
  Stethoscope,
  ClipboardList,
} from "lucide-react";
import { PatientWhatsAppButton } from "@/components/ui/patient-whatsapp-button";
import { buildPatientContactMessage } from "@/lib/utils/patient-messages";
import { Button } from "@/components/ui/button";
import type {
  PatientEhrAttachment,
  PatientEhrConsultation,
  PatientEhrDiagnosisRow,
  PatientEhrPrescription,
  PatientEhrTreatmentRow,
} from "@/lib/utils/patient-ehr-model";

type SummaryTab = "diagnostics" | "treatments" | "vitals" | "files" | "prescriptions";

const SUMMARY_TABS: { key: SummaryTab; label: string; icon: typeof Stethoscope }[] = [
  { key: "diagnostics", label: "Diagnósticos", icon: Stethoscope },
  { key: "treatments", label: "Tratamientos", icon: Pill },
  { key: "vitals", label: "Signos vitales", icon: Activity },
  { key: "files", label: "Archivos", icon: FileStack },
  { key: "prescriptions", label: "Recetas", icon: ClipboardList },
];

interface PatientInfo {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
  birth_date: string | null;
  age_label: string | null;
  insurance_provider: string | null;
  insurance_number: string | null;
  phone: string | null;
}

interface Props {
  patient: PatientInfo;
  consultations: PatientEhrConsultation[];
  diagnosisRows: PatientEhrDiagnosisRow[];
  treatmentRows: PatientEhrTreatmentRow[];
  attachments: PatientEhrAttachment[];
  prescriptions: PatientEhrPrescription[];
  totalConsultations: number;
  usesHceExport?: boolean;
}

function listPreview(text: string, max = 72): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "Sin texto";
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function evolutionBody(c: PatientEhrConsultation): string {
  const evo = c.evolution?.trim();
  if (evo && evo.length > 0) return evo;
  const cc = c.chief_complaint?.trim();
  if (cc && !/importado|^\[DRAPP:|^\[HCE:|^\[PDF:/i.test(cc)) return cc;
  return evo || cc || "Sin texto de evolución registrado.";
}

export function PatientEhrView({
  patient,
  consultations,
  diagnosisRows,
  treatmentRows,
  attachments,
  prescriptions,
  totalConsultations,
  usesHceExport = false,
}: Props) {
  const sorted = useMemo(
    () =>
      [...consultations].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [consultations]
  );

  const evolutionList = useMemo(() => {
    const withText = sorted.filter(
      (c) =>
        c.category === "evolution" ||
        (c.evolution?.trim().length ?? 0) > 15 ||
        (c.category !== "vitals" &&
          c.category !== "treatment" &&
          c.category !== "diagnostic" &&
          (c.chief_complaint?.trim().length ?? 0) > 20)
    );
    return withText.length > 0 ? withText : sorted.filter((c) => c.category === "evolution");
  }, [sorted]);

  const [selectedId, setSelectedId] = useState<string | null>(
    evolutionList[0]?.id ?? sorted[0]?.id ?? null
  );
  const [search, setSearch] = useState("");
  const [summaryTab, setSummaryTab] = useState<SummaryTab>("diagnostics");

  const counts: Record<SummaryTab, number> = {
    diagnostics: diagnosisRows.length,
    treatments: treatmentRows.length,
    vitals: sorted.filter((c) => c.category === "vitals").length,
    files: attachments.length,
    prescriptions: prescriptions.length,
  };

  const filteredList = useMemo(() => {
    const base = evolutionList.length > 0 ? evolutionList : sorted;
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (c) =>
        c.evolution.toLowerCase().includes(q) ||
        c.chief_complaint.toLowerCase().includes(q) ||
        c.diagnosis.toLowerCase().includes(q) ||
        c.professional_name.toLowerCase().includes(q)
    );
  }, [evolutionList, sorted, search]);

  const selected =
    sorted.find((c) => c.id === selectedId) ?? filteredList[0] ?? sorted[0] ?? null;

  const patientDisplay = `${patient.last_name}, ${patient.first_name}`;
  const vitalsRows = sorted.filter((c) => c.category === "vitals");

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col bg-gradient-to-b from-slate-50 to-slate-100/90 print:bg-white">
      {/* Paciente */}
      <div className="border-b border-slate-200/80 bg-white px-4 py-4 shadow-sm sm:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              {patientDisplay}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                DNI {patient.document_number}
              </span>
              {patient.age_label && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {patient.age_label}
                </span>
              )}
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {patient.insurance_provider?.includes("PAMI")
                  ? `PAMI ${patient.insurance_number ?? ""}`.trim()
                  : patient.insurance_provider ?? "Obra social —"}
              </span>
              {patient.phone && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                  {patient.phone}
                  <PatientWhatsAppButton
                    phone={patient.phone}
                    message={buildPatientContactMessage(
                      `${patient.first_name} ${patient.last_name}`
                    )}
                    size="icon"
                  />
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>{totalConsultations} registros</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-slate-600"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </div>
      </div>

      {usesHceExport ? (
        <div className="border-b border-sky-200/80 bg-sky-50 px-4 py-2.5 text-sm text-sky-950 sm:px-6">
          Parte del resumen viene del export HCE. Las evoluciones largas suelen requerir el{" "}
          <Link href="/datos" className="font-medium text-sky-800 underline underline-offset-2">
            PDF o el JSONL teams
          </Link>
          .
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 p-4 lg:flex-row lg:overflow-hidden lg:p-6">
        {/* Timeline */}
        <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm lg:w-80 xl:w-[22rem]">
          <div className="border-b border-slate-100 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              Evoluciones
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar en la historia…"
                className="w-full rounded-xl border-0 bg-slate-100 py-2.5 pl-9 pr-3 text-sm text-slate-800 ring-1 ring-slate-200/80 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-teal-500/30"
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto lg:max-h-[calc(100vh-18rem)] lg:flex-1">
            {filteredList.map((c) => {
              const active = c.id === (selected?.id ?? null);
              const dateLabel = format(new Date(c.created_at), "d MMM yyyy", { locale: es });
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`flex w-full flex-col gap-0.5 border-b border-slate-50 px-4 py-3 text-left transition ${
                    active
                      ? "border-l-[3px] border-l-teal-600 bg-teal-50/80 pl-[calc(1rem-3px)]"
                      : "border-l-[3px] border-l-transparent hover:bg-slate-50"
                  }`}
                >
                  <span className="text-xs font-medium text-teal-800">{dateLabel}</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {c.professional_name}
                  </span>
                  <span className="line-clamp-2 text-xs leading-snug text-slate-500">
                    {listPreview(evolutionBody(c))}
                  </span>
                </button>
              );
            })}
            {filteredList.length === 0 && (
              <p className="p-6 text-center text-sm text-slate-500">
                No hay evoluciones que coincidan con la búsqueda.
              </p>
            )}
          </div>
        </aside>

        {/* Contenido principal: evolución + resumen clínico */}
        <main className="flex min-h-0 flex-1 flex-col gap-4 lg:overflow-hidden">
          {/* Evolución — panel principal (antes quedaba vacío / solo signos vitales) */}
          <section className="flex min-h-[280px] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm print:shadow-none">
            {selected ? (
              <>
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-800">
                      <CalendarDays className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-slate-900">
                        {format(new Date(selected.created_at), "EEEE d 'de' MMMM yyyy", {
                          locale: es,
                        })}
                      </p>
                      <p className="text-sm text-slate-500">
                        {format(new Date(selected.created_at), "HH:mm", { locale: es })} hs ·{" "}
                        {selected.professional_name}
                      </p>
                    </div>
                  </div>
                  <Link href={`/historias/${selected.id}`}>
                    <Button variant="outline" size="sm" className="gap-1">
                      Consulta completa
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </header>

                <div className="flex-1 overflow-y-auto px-5 py-5 lg:px-8 lg:py-6">
                  <article className="prose prose-slate max-w-none prose-p:leading-relaxed prose-p:text-slate-800">
                    <p className="whitespace-pre-wrap text-base leading-7 text-slate-800">
                      {evolutionBody(selected)}
                    </p>
                  </article>

                  {(selected.diagnosis?.trim() || selected.indications?.trim()) && (
                    <div className="mt-8 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2">
                      {selected.diagnosis?.trim() && (
                        <div className="rounded-xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Diagnóstico en esta consulta
                          </p>
                          <p className="mt-1 text-sm text-slate-800">{selected.diagnosis}</p>
                        </div>
                      )}
                      {selected.indications?.trim() && (
                        <div className="rounded-xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Indicaciones
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                            {selected.indications}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
                <p className="text-lg font-medium text-slate-700">Sin evoluciones</p>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  Elegí una entrada del listado o importá la historia desde Datos.
                </p>
              </div>
            )}
          </section>

          {/* Resumen clínico (tabs) */}
          <section className="shrink-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex gap-1 overflow-x-auto border-b border-slate-100 p-2">
              {SUMMARY_TABS.map(({ key, label, icon: Icon }) => {
                const n = counts[key];
                const active = summaryTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSummaryTab(key)}
                    className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      active
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="h-4 w-4 opacity-80" />
                    {label}
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-xs ${
                        active ? "bg-white/20" : "bg-slate-200/80 text-slate-700"
                      }`}
                    >
                      {n}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="max-h-64 overflow-y-auto p-4 sm:max-h-72">
              {summaryTab === "diagnostics" && (
                <>
                  {diagnosisRows.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-500">
                      Sin diagnósticos registrados.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {diagnosisRows.map((row) => (
                        <li
                          key={row.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0"
                        >
                          <div>
                            {row.chronic && (
                              <span className="mr-2 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                                Crónico
                              </span>
                            )}
                            <Link
                              href={`/historias/${row.recordId}`}
                              className="font-medium text-slate-900 hover:text-teal-700"
                            >
                              {row.name}
                            </Link>
                          </div>
                          <span className="text-xs tabular-nums text-slate-500">{row.dateLabel}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {summaryTab === "treatments" && (
                <>
                  {treatmentRows.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-500">
                      Sin tratamientos registrados.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[520px] text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                            <th className="pb-2 pr-3 font-medium">Fecha</th>
                            <th className="pb-2 pr-3 font-medium">Producto</th>
                            <th className="pb-2 pr-3 font-medium">Dosis</th>
                            <th className="pb-2 font-medium">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {treatmentRows.map((row) => (
                            <tr key={row.id} className="text-slate-800">
                              <td className="py-2.5 pr-3 whitespace-nowrap text-slate-500">
                                {row.dateLabel}
                              </td>
                              <td className="py-2.5 pr-3 font-medium">
                                <Link
                                  href={`/historias/${row.recordId}`}
                                  className="hover:text-teal-700"
                                >
                                  {row.product}
                                </Link>
                              </td>
                              <td className="py-2.5 pr-3 text-slate-600">{row.dose}</td>
                              <td className="py-2.5 text-emerald-700">{row.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {summaryTab === "vitals" && (
                <>
                  {vitalsRows.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-500">
                      Sin signos vitales registrados.
                    </p>
                  ) : (
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {vitalsRows.map((c) => (
                        <li
                          key={c.id}
                          className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm"
                        >
                          <p className="text-xs font-medium text-slate-500">
                            {format(new Date(c.created_at), "d MMM yyyy", { locale: es })}
                          </p>
                          <p className="mt-1 text-slate-800">
                            {c.evolution || c.chief_complaint}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {summaryTab === "files" && (
                <>
                  {attachments.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-500">Sin archivos adjuntos.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 text-sm">
                      {attachments.map((a) => (
                        <li key={a.id} className="flex justify-between gap-2 py-2.5">
                          <span className="font-medium text-slate-800">{a.file_name}</span>
                          <span className="shrink-0 text-xs text-slate-500">
                            {format(new Date(a.created_at), "dd/MM/yyyy", { locale: es })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {summaryTab === "prescriptions" && (
                <>
                  {prescriptions.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-500">Sin recetas.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 text-sm">
                      {prescriptions.map((p) => (
                        <li key={p.id} className="py-2.5 text-slate-800">
                          {format(new Date(p.created_at), "dd/MM/yyyy", { locale: es })} — {p.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
