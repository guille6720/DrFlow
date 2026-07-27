"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Calendar,
  Filter,
  Lock,
  Printer,
  Search,
  StickyNote,
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

type ModuleKey = "evolutions" | "files" | "diagnostics" | "treatments" | "vitals" | "prescriptions";

const MODULE_LABELS: Record<ModuleKey, string> = {
  evolutions: "Evoluciones",
  files: "Archivos",
  diagnostics: "Diagnósticos",
  treatments: "Tratamientos",
  vitals: "Signos vitales",
  prescriptions: "Recetas",
};

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

function formatEvolutionHeader(iso: string, professional: string): string {
  const d = new Date(iso);
  const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  const label = `${d.getDate()}-${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
  return `${label} ${professional}`;
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

  const evolutionList = useMemo(
    () => sorted.filter((c) => c.category === "evolution" || c.evolution.trim().length > 20),
    [sorted]
  );

  const [selectedId, setSelectedId] = useState<string | null>(
    evolutionList[0]?.id ?? sorted[0]?.id ?? null
  );
  const [search, setSearch] = useState("");
  const [modules, setModules] = useState<Record<ModuleKey, boolean>>({
    evolutions: true,
    files: true,
    diagnostics: true,
    treatments: true,
    vitals: true,
    prescriptions: true,
  });

  const counts: Record<ModuleKey, number> = {
    evolutions: evolutionList.length,
    files: attachments.length,
    diagnostics: diagnosisRows.length,
    treatments: treatmentRows.length,
    vitals: sorted.filter((c) => c.category === "vitals").length,
    prescriptions: prescriptions.length,
  };

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return evolutionList.length > 0 ? evolutionList : sorted;
    return (evolutionList.length > 0 ? evolutionList : sorted).filter(
      (c) =>
        c.evolution.toLowerCase().includes(q) ||
        c.chief_complaint.toLowerCase().includes(q) ||
        c.diagnosis.toLowerCase().includes(q) ||
        c.professional_name.toLowerCase().includes(q)
    );
  }, [evolutionList, sorted, search]);

  const selected =
    sorted.find((c) => c.id === selectedId) ?? filteredList[0] ?? sorted[0] ?? null;

  const displayDate = selected
    ? format(new Date(selected.created_at), "dd/MM/yyyy")
    : format(new Date(), "dd/MM/yyyy");

  const patientDisplay = `${patient.last_name}, ${patient.first_name}`;

  function toggleModule(key: ModuleKey) {
    setModules((m) => ({ ...m, [key]: !m[key] }));
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col bg-slate-100/80 print:bg-white">
      {/* Barra paciente */}
      <div className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-slate-500">Nombre </span>
            <span className="text-lg font-semibold text-blue-700">{patientDisplay}</span>
          </div>
          <div>
            <span className="text-slate-500">DNI </span>
            <span className="font-medium text-slate-800">{patient.document_number}</span>
          </div>
          <div>
            <span className="text-slate-500">Edad </span>
            <span className="text-slate-800">{patient.age_label ?? "Sin definir"}</span>
          </div>
          <div>
            <span className="text-slate-500">PAMI </span>
            <span className="text-slate-800">
              {patient.insurance_provider?.includes("PAMI")
                ? patient.insurance_number ?? "PAMI"
                : patient.insurance_provider ?? "—"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Teléfono </span>
            <span className="text-slate-800">{patient.phone ?? "—"}</span>
            <PatientWhatsAppButton
              phone={patient.phone}
              message={buildPatientContactMessage(
                `${patient.first_name} ${patient.last_name}`
              )}
              size="icon"
            />
          </div>
          <div className="ml-auto text-xs text-slate-500">
            {totalConsultations} registro(s) en la historia
          </div>
        </div>
      </div>

      {usesHceExport ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950">
          Diagnósticos y tratamientos se muestran desde el export HCE original (como en el sistema
          anterior). Las evoluciones con texto largo suelen venir del{" "}
          <Link href="/datos" className="font-medium text-blue-700 underline">
            PDF de historia clínica
          </Link>
          ; si el contador de evoluciones está en 0, importalo desde Datos.
        </div>
      ) : null}

      {/* Toolbar módulos */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2">
        <div className="flex flex-wrap items-center gap-4">
          {(Object.keys(MODULE_LABELS) as ModuleKey[]).map((key) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                checked={modules[key]}
                onChange={() => toggleModule(key)}
                className="rounded border-slate-300 text-blue-600"
              />
              {MODULE_LABELS[key]}
              <sup className="text-xs font-semibold text-blue-600">{counts[key]}</sup>
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            className="text-slate-600 hover:text-blue-700"
            onClick={() => window.print()}
          >
            <Printer className="mr-1 inline h-4 w-4" />
            Imprimir
          </button>
          <span className="text-slate-300">|</span>
          <span className="flex items-center gap-1 text-slate-600">
            <Filter className="h-4 w-4" />
            Filtros
          </span>
          <Button variant="outline" size="sm" className="ml-1">
            <StickyNote className="h-4 w-4" />
            Notas
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col lg:flex-row lg:overflow-hidden">
        {/* Columna izquierda */}
        <aside className="flex w-full flex-col border-b border-slate-200 bg-white lg:w-[min(100%,22rem)] lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-100 p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscador de evoluciones…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto border-b border-slate-100 lg:max-h-none lg:flex-1">
            {filteredList.map((c) => {
              const active = c.id === (selected?.id ?? null);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`block w-full border-b border-slate-50 px-4 py-2.5 text-left text-sm transition ${
                    active
                      ? "bg-blue-50 font-semibold text-blue-900"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {formatEvolutionHeader(c.created_at, c.professional_name)}
                </button>
              );
            })}
            {filteredList.length === 0 && (
              <p className="p-4 text-sm text-slate-500">Sin evoluciones para mostrar.</p>
            )}
          </div>

          {modules.evolutions && selected && (
            <div className="hidden flex-1 overflow-y-auto p-4 lg:block">
              <p className="mb-3 text-sm font-semibold text-slate-800">
                {formatEvolutionHeader(selected.created_at, selected.professional_name)}
              </p>
              <section className="mb-4">
                <h3 className="mb-1 text-xs font-bold tracking-wide text-slate-500">EVOLUCIONES</h3>
                <p className="text-xs text-slate-400">
                  {format(new Date(selected.created_at), "HH:mm:ss", { locale: es })}{" "}
                  <Lock className="inline h-3 w-3" />
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {selected.evolution || selected.chief_complaint || "Sin texto de evolución."}
                </p>
              </section>
              {selected.diagnosis && modules.diagnostics && (
                <section className="mb-4">
                  <h3 className="mb-1 text-xs font-bold tracking-wide text-slate-500">DIAGNÓSTICOS</h3>
                  <ul className="list-inside list-disc text-sm text-slate-700">
                    <li>{selected.diagnosis}</li>
                  </ul>
                </section>
              )}
              {selected.indications && modules.treatments && (
                <section>
                  <h3 className="mb-1 text-xs font-bold tracking-wide text-slate-500">TRATAMIENTOS</h3>
                  <ul className="space-y-1 text-sm text-slate-700">
                    {selected.indications.split(/\n+/).map((line) => (
                      <li key={line.slice(0, 40)}>{line.trim()}</li>
                    ))}
                  </ul>
                </section>
              )}
              <Link
                href={`/historias/${selected.id}`}
                className="mt-4 inline-block text-sm font-medium text-blue-700 hover:underline"
              >
                Abrir consulta completa →
              </Link>
            </div>
          )}
        </aside>

        {/* Panel derecho */}
        <main className="flex-1 overflow-y-auto bg-slate-100/50 p-4">
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-100 px-4 py-2.5 text-slate-800 shadow-sm">
            <Calendar className="h-5 w-5 text-amber-800" />
            <span className="text-lg font-semibold">{displayDate}</span>
            {selected && (
              <span className="text-sm text-slate-600">
                · {selected.professional_name}
              </span>
            )}
          </div>

          {modules.diagnostics && (
            <section className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <h2 className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-base font-semibold text-slate-800">
                Diagnósticos
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-slate-500">
                      <th className="px-4 py-2 font-medium">Fecha</th>
                      <th className="px-4 py-2 font-medium">Nombre</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diagnosisRows.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-4 py-6 text-slate-500">
                          Sin diagnósticos registrados.
                        </td>
                      </tr>
                    ) : (
                      diagnosisRows.map((row) => (
                        <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/80">
                          <td className="whitespace-nowrap px-4 py-2 text-slate-600">{row.dateLabel}</td>
                          <td className="px-4 py-2 text-slate-800">
                            {row.chronic && (
                              <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                                Crónico
                              </span>
                            )}
                            <Link href={`/historias/${row.recordId}`} className="hover:text-blue-700">
                              {row.name}
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {modules.treatments && (
            <section className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <h2 className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-base font-semibold text-slate-800">
                Tratamientos
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-slate-500">
                      <th className="px-3 py-2 font-medium">Fecha</th>
                      <th className="px-3 py-2 font-medium">Producto</th>
                      <th className="px-3 py-2 font-medium">Dosis</th>
                      <th className="px-3 py-2 font-medium">Frecuencia</th>
                      <th className="px-3 py-2 font-medium">Notas</th>
                      <th className="px-3 py-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {treatmentRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-slate-500">
                          Sin tratamientos registrados.
                        </td>
                      </tr>
                    ) : (
                      treatmentRows.map((row) => (
                        <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/80">
                          <td className="whitespace-nowrap px-3 py-2">{row.dateLabel}</td>
                          <td className="px-3 py-2 font-medium">{row.product}</td>
                          <td className="px-3 py-2">{row.dose}</td>
                          <td className="px-3 py-2">{row.frequency}</td>
                          <td className="max-w-xs truncate px-3 py-2 text-slate-600" title={row.notes}>
                            {row.notes}
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-emerald-700">{row.status}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {modules.vitals && sorted.some((c) => c.category === "vitals") && (
            <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-base font-semibold">Signos vitales</h2>
              <ul className="space-y-2 text-sm">
                {sorted
                  .filter((c) => c.category === "vitals")
                  .map((c) => (
                    <li key={c.id}>
                      <span className="font-medium">{formatEvolutionHeader(c.created_at, "")}</span>
                      {c.evolution || c.chief_complaint}
                    </li>
                  ))}
              </ul>
            </section>
          )}

          {modules.files && attachments.length > 0 && (
            <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-base font-semibold">Archivos</h2>
              <ul className="divide-y divide-slate-100 text-sm">
                {attachments.map((a) => (
                  <li key={a.id} className="py-2">
                    {a.file_name}{" "}
                    <span className="text-slate-400">
                      · {format(new Date(a.created_at), "dd/MM/yyyy", { locale: es })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {modules.prescriptions && prescriptions.length > 0 && (
            <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-base font-semibold">Recetas</h2>
              <ul className="space-y-1 text-sm">
                {prescriptions.map((p) => (
                  <li key={p.id}>
                    {format(new Date(p.created_at), "dd/MM/yyyy", { locale: es })} — {p.label}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {modules.evolutions && selected && (
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:hidden">
              <h2 className="mb-2 text-base font-semibold">Evolución seleccionada</h2>
              <p className="whitespace-pre-wrap text-sm text-slate-700">
                {selected.evolution || selected.chief_complaint}
              </p>
              <Link href={`/historias/${selected.id}`} className="mt-2 inline-block text-sm text-blue-700">
                Ver consulta completa
              </Link>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
