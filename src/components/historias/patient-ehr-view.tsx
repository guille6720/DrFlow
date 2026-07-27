"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  Activity,
  ArrowLeft,
  ChevronRight,
  Clock,
  FileStack,
  Pill,
  Printer,
  Search,
  Stethoscope,
  ClipboardList,
  User,
  List,
} from "lucide-react";
import { PatientWhatsAppButton } from "@/components/ui/patient-whatsapp-button";
import { buildPatientContactMessage } from "@/lib/utils/patient-messages";
import type {
  PatientEhrAttachment,
  PatientEhrConsultation,
  PatientEhrDiagnosisRow,
  PatientEhrPrescription,
  PatientEhrTreatmentRow,
} from "@/lib/utils/patient-ehr-model";

type SummaryTab = "diagnostics" | "treatments" | "vitals" | "files" | "prescriptions";

const TEAL_BTN =
  "flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:from-cyan-600 hover:to-teal-600 active:scale-[0.99]";

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

function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function ageNumber(age_label: string | null): string | null {
  if (!age_label) return null;
  const m = age_label.match(/\d+/);
  return m ? m[0] : null;
}

function listPreview(text: string, max = 56): string {
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

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3.5 last:border-0">
      <span className="text-sm font-medium text-slate-500">{label}</span>
      <span className="text-right text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
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
  const [mobilePane, setMobilePane] = useState<"list" | "detail">("list");
  const [hideEvolutionList, setHideEvolutionList] = useState(false);

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

  const patientDisplay = `${patient.first_name} ${patient.last_name}`;
  const patientFormal = `${patient.last_name}, ${patient.first_name}`;
  const vitalsRows = sorted.filter((c) => c.category === "vitals");
  const age = ageNumber(patient.age_label);
  const dobLabel = (() => {
    if (!patient.birth_date) return "—";
    try {
      const raw = patient.birth_date;
      const d = raw.includes("T") ? parseISO(raw) : parseISO(`${raw}T12:00:00`);
      return format(d, "dd/MM/yyyy");
    } catch {
      return patient.birth_date;
    }
  })();
  const insuranceLabel = patient.insurance_provider?.includes("PAMI")
    ? `PAMI ${patient.insurance_number ?? ""}`.trim()
    : patient.insurance_provider ?? "—";

  function pickEvolution(id: string) {
    setSelectedId(id);
    setMobilePane("detail");
  }

  const focusReading = hideEvolutionList;

  const layoutToolbar = (
    <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
      <button
        type="button"
        onClick={() => setHideEvolutionList((v) => !v)}
        className="hidden items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/90 hover:bg-slate-50 lg:inline-flex"
        title={hideEvolutionList ? "Mostrar listado de evoluciones" : "Ocultar listado de evoluciones"}
      >
        <List className="h-4 w-4 text-cyan-600" />
        {hideEvolutionList ? "Mostrar listado" : "Ocultar listado"}
      </button>
    </div>
  );

  const evolutionCards = (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-bold text-slate-900">Evoluciones</h2>
        <span className="text-xs font-medium text-slate-500">{filteredList.length} entradas</span>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar…"
          className="w-full rounded-2xl border-0 bg-white py-3 pl-11 pr-4 text-sm shadow-md shadow-slate-200/60 ring-1 ring-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-400/40"
        />
      </div>

      {filteredList.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center text-sm text-slate-500 shadow-md">
          No hay evoluciones para mostrar.
        </div>
      ) : (
        filteredList.map((c) => {
          const active = c.id === (selected?.id ?? null);
          const timeStart = format(new Date(c.created_at), "hh:mm a", { locale: es });
          return (
            <article
              key={c.id}
              className={`rounded-3xl bg-white p-5 shadow-md shadow-slate-200/50 ring-1 transition ${
                active ? "ring-2 ring-cyan-400/60" : "ring-slate-100"
              }`}
            >
              <p className="text-lg font-bold text-slate-900">
                {format(new Date(c.created_at), "d MMM yyyy", { locale: es })}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                {age && (
                  <span className="inline-flex items-center gap-1.5">
                    <User className="h-4 w-4 text-cyan-600" />
                    <span className="font-semibold text-slate-800">{age}</span>
                    <span>años</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-cyan-600" />
                  <span className="font-medium">{timeStart}</span>
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                {c.professional_name} · {listPreview(evolutionBody(c))}
              </p>
              <span className="mt-3 inline-block rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800">
                Consulta clínica
              </span>
              <button type="button" className={`${TEAL_BTN} mt-4`} onClick={() => pickEvolution(c.id)}>
                Ver evolución
                <ChevronRight className="h-4 w-4" />
              </button>
            </article>
          );
        })
      )}
    </div>
  );

  const detailPane = (
    <div className="flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 lg:hidden"
        onClick={() => setMobilePane("list")}
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al listado
      </button>

      {/* Header tipo app */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 text-sm font-bold text-white shadow-md">
          {initials(patient.first_name, patient.last_name)}
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Paciente</p>
          <p className="text-lg font-bold text-slate-900">{patientDisplay}</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="ml-auto rounded-full bg-white p-2.5 text-slate-500 shadow-sm ring-1 ring-slate-100 print:hidden"
          aria-label="Imprimir"
        >
          <Printer className="h-4 w-4" />
        </button>
      </div>

      {usesHceExport ? (
        <p className="mb-4 rounded-2xl bg-cyan-50 px-4 py-3 text-xs text-cyan-950">
          Datos parciales del export HCE. Completá con{" "}
          <Link href="/datos" className="font-semibold underline">
            PDF o JSONL
          </Link>
          .
        </p>
      ) : null}

      {/* Evolución — bloque principal (estilo “New clinical entry”) */}
      <section className="mb-4 rounded-3xl bg-white p-5 shadow-md shadow-slate-200/50 ring-1 ring-slate-100">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">Evolución clínica</h3>
          {hideEvolutionList && filteredList.length > 1 && (
            <select
              value={selected?.id ?? ""}
              onChange={(e) => setSelectedId(e.target.value)}
              className="max-w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
            >
              {filteredList.map((c) => (
                <option key={c.id} value={c.id}>
                  {format(new Date(c.created_at), "d MMM yyyy", { locale: es })} —{" "}
                  {c.professional_name}
                </option>
              ))}
            </select>
          )}
        </div>
        {selected ? (
          <>
            <p className="mt-1 text-xs text-slate-500">
              {format(new Date(selected.created_at), "EEEE d MMMM yyyy · HH:mm", { locale: es })} ·{" "}
              {selected.professional_name}
            </p>
            <div className="mt-4 min-h-[200px] rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm leading-relaxed text-slate-800">
              <p className="whitespace-pre-wrap">{evolutionBody(selected)}</p>
            </div>
            {selected.diagnosis?.trim() && (
              <div className="mt-3">
                <label className="text-xs font-semibold text-slate-500">Diagnóstico</label>
                <div className="mt-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800">
                  {selected.diagnosis}
                </div>
              </div>
            )}
            {selected.indications?.trim() && (
              <div className="mt-3">
                <label className="text-xs font-semibold text-slate-500">Indicaciones</label>
                <div className="mt-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm whitespace-pre-wrap text-slate-800">
                  {selected.indications}
                </div>
              </div>
            )}
            <Link href={`/historias/${selected.id}`} className={`${TEAL_BTN} mt-5`}>
              Abrir consulta completa
              <ChevronRight className="h-4 w-4" />
            </Link>
          </>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Seleccioná una evolución del listado.</p>
        )}
      </section>

      {/* Datos del paciente */}
      <section className="mb-4 rounded-3xl bg-white px-5 py-2 shadow-md shadow-slate-200/50 ring-1 ring-slate-100">
        <h3 className="border-b border-slate-100 py-3 text-sm font-bold text-slate-900">
          Información del paciente
        </h3>
        <InfoRow label="Nombre" value={patientFormal} />
        <InfoRow label="DNI" value={patient.document_number} />
        <InfoRow label="Edad" value={patient.age_label ?? "—"} />
        <InfoRow label="Fecha de nacimiento" value={dobLabel} />
        <InfoRow label="Obra social" value={insuranceLabel} />
        <InfoRow
          label="Contacto"
          value={
            patient.phone ? (
              <span className="inline-flex items-center gap-2">
                {patient.phone}
                <PatientWhatsAppButton
                  phone={patient.phone}
                  message={buildPatientContactMessage(patientDisplay)}
                  size="icon"
                />
              </span>
            ) : (
              "—"
            )
          }
        />
        <InfoRow label="Registros en historia" value={String(totalConsultations)} />
      </section>

      {/* Resumen clínico */}
      <section className="mb-6 overflow-hidden rounded-3xl bg-white shadow-md shadow-slate-200/50 ring-1 ring-slate-100">
        <div className="flex gap-1 overflow-x-auto p-2">
          {SUMMARY_TABS.map(({ key, label, icon: Icon }) => {
            const n = counts[key];
            const active = summaryTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSummaryTab(key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  active
                    ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                <span className={active ? "opacity-90" : "text-slate-400"}>({n})</span>
              </button>
            );
          })}
        </div>
        <div className="max-h-56 overflow-y-auto border-t border-slate-100 p-4 text-sm">
          {summaryTab === "diagnostics" &&
            (diagnosisRows.length === 0 ? (
              <p className="py-4 text-center text-slate-500">Sin diagnósticos.</p>
            ) : (
              <ul className="space-y-3">
                {diagnosisRows.map((row) => (
                  <li key={row.id} className="rounded-xl bg-slate-50 px-3 py-2.5">
                    <Link href={`/historias/${row.recordId}`} className="font-medium text-slate-900">
                      {row.name}
                    </Link>
                    <p className="text-xs text-slate-500">{row.dateLabel}</p>
                  </li>
                ))}
              </ul>
            ))}
          {summaryTab === "treatments" &&
            (treatmentRows.length === 0 ? (
              <p className="py-4 text-center text-slate-500">Sin tratamientos.</p>
            ) : (
              <ul className="space-y-3">
                {treatmentRows.map((row) => (
                  <li key={row.id} className="rounded-xl bg-slate-50 px-3 py-2.5">
                    <Link href={`/historias/${row.recordId}`} className="font-medium text-slate-900">
                      {row.product}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {row.dateLabel} · {row.dose}
                    </p>
                  </li>
                ))}
              </ul>
            ))}
          {summaryTab === "vitals" &&
            (vitalsRows.length === 0 ? (
              <p className="py-4 text-center text-slate-500">Sin signos vitales.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {vitalsRows.map((c) => (
                  <li key={c.id} className="rounded-xl bg-slate-50 px-3 py-2.5">
                    <p className="text-xs text-slate-500">
                      {format(new Date(c.created_at), "d MMM yyyy", { locale: es })}
                    </p>
                    <p className="text-slate-800">{c.evolution || c.chief_complaint}</p>
                  </li>
                ))}
              </ul>
            ))}
          {summaryTab === "files" &&
            (attachments.length === 0 ? (
              <p className="py-4 text-center text-slate-500">Sin archivos.</p>
            ) : (
              attachments.map((a) => (
                <p key={a.id} className="border-b border-slate-50 py-2 last:border-0">
                  {a.file_name}
                </p>
              ))
            ))}
          {summaryTab === "prescriptions" &&
            (prescriptions.length === 0 ? (
              <p className="py-4 text-center text-slate-500">Sin recetas.</p>
            ) : (
              prescriptions.map((p) => (
                <p key={p.id} className="border-b border-slate-50 py-2 last:border-0">
                  {p.label}
                </p>
              ))
            ))}
        </div>
      </section>

      <Link href={`/historias/nueva?patient=${patient.id}`} className={`${TEAL_BTN} sticky bottom-4 print:hidden`}>
        Nueva consulta
      </Link>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-transparent print:bg-white">
      <div
        className={`mx-auto px-4 py-5 sm:px-6 lg:py-8 ${
          focusReading ? "max-w-4xl" : "max-w-6xl"
        }`}
      >
        {layoutToolbar}
        <div
          className={
            hideEvolutionList
              ? "lg:block"
              : "lg:grid lg:grid-cols-[minmax(0,340px)_1fr] lg:items-start lg:gap-6"
          }
        >
          <div
            className={`${mobilePane === "detail" ? "hidden lg:block" : ""} ${
              hideEvolutionList ? "hidden lg:hidden" : ""
            }`}
          >
            {evolutionCards}
          </div>
          <div className={`${mobilePane === "list" ? "hidden lg:block" : ""} lg:min-h-[70vh]`}>
            {detailPane}
          </div>
        </div>
      </div>
    </div>
  );
}
