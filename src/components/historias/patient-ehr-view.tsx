"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  Activity,
  ClipboardList,
  ExternalLink,
  FileStack,
  Loader2,
  Pill,
  Plus,
  Printer,
  Stethoscope,
} from "lucide-react";
import { PatientWhatsAppButton } from "@/components/ui/patient-whatsapp-button";
import { getPatientClinicalDocumentUrl } from "@/lib/actions/patient-attachments";
import { buildPatientContactMessage } from "@/lib/utils/patient-messages";
import { HCE_SUMMARY_ATTACHMENT_NAME } from "@/lib/utils/patient-ehr-from-hce";
import type {
  PatientEhrAttachment,
  PatientEhrConsultation,
  PatientEhrDiagnosisRow,
  PatientEhrPrescription,
  PatientEhrTreatmentRow,
} from "@/lib/utils/patient-ehr-model";
import { sanitizeClinicalDisplayText } from "@/lib/utils/sanitize-clinical-display";
import { withClinicalHistoryReturn } from "@/lib/utils/clinical-navigation";
import { cn } from "@/lib/utils/cn";

type FilterKey = "evolutions" | "files" | "diagnostics" | "treatments" | "vitals" | "prescriptions";

const FILTER_OPTIONS: { key: FilterKey; label: string; icon: typeof Stethoscope }[] = [
  { key: "evolutions", label: "Evoluciones", icon: Stethoscope },
  { key: "files", label: "Archivos", icon: FileStack },
  { key: "diagnostics", label: "Diagnósticos", icon: Stethoscope },
  { key: "treatments", label: "Tratamientos", icon: Pill },
  { key: "vitals", label: "Signos vitales", icon: Activity },
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
  email?: string | null;
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

function formatSidebarDate(iso: string): string {
  const d = new Date(iso);
  const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  const yy = String(d.getFullYear()).slice(-2);
  return `${d.getDate()}-${months[d.getMonth()]}-${yy}`;
}

function evolutionBody(c: PatientEhrConsultation): string {
  const evo = sanitizeClinicalDisplayText(c.evolution);
  if (evo.length > 0) return evo;
  const ccRaw = c.chief_complaint?.trim() ?? "";
  if (/^\[(?:IMPORT|DRAPP|HCE|PDF):/i.test(ccRaw)) {
    return "Sin texto de evolución registrado.";
  }
  const cc = sanitizeClinicalDisplayText(ccRaw);
  if (cc && !/^importado\b/i.test(cc)) return cc;
  return cc || "Sin texto de evolución registrado.";
}

function DemographicCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="drflow-ehr-demo-cell min-w-[7rem] flex-1 px-3 py-2">
      <p className="drflow-ehr-demo-label text-[11px] font-semibold uppercase tracking-wide">{label}</p>
      <p className="drflow-ehr-demo-value mt-0.5 truncate text-sm font-medium">{value}</p>
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

  const [filters, setFilters] = useState<Record<FilterKey, boolean>>({
    evolutions: true,
    files: true,
    diagnostics: true,
    treatments: true,
    vitals: true,
    prescriptions: true,
  });
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const visibleAttachments = useMemo(
    () => attachments.filter((a) => a.file_name !== HCE_SUMMARY_ATTACHMENT_NAME),
    [attachments]
  );

  const attachmentByFileName = useMemo(() => {
    const map = new Map<string, PatientEhrAttachment>();
    for (const attachment of visibleAttachments) {
      map.set(attachment.file_name.toLowerCase(), attachment);
    }
    return map;
  }, [visibleAttachments]);

  async function handleOpenAttachment(id: string) {
    setOpeningAttachmentId(id);
    setAttachmentError(null);
    const result = await getPatientClinicalDocumentUrl(id);
    setOpeningAttachmentId(null);
    if (result.error || !result.url) {
      setAttachmentError(result.error ?? "No se pudo abrir el documento");
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  const selected =
    sorted.find((c) => c.id === selectedId) ?? evolutionList[0] ?? sorted[0] ?? null;

  const selectedDocumentAttachment = useMemo(() => {
    if (!selected || selected.category !== "document") return null;
    const fileName = selected.diagnosis?.trim().toLowerCase();
    if (!fileName) return null;
    return attachmentByFileName.get(fileName) ?? null;
  }, [attachmentByFileName, selected]);

  const patientFormal = `${patient.last_name}, ${patient.first_name}`;
  const patientDisplay = `${patient.first_name} ${patient.last_name}`;
  const vitalsRows = sorted.filter((c) => c.category === "vitals");

  const dobLabel = (() => {
    if (!patient.birth_date) return "Sin definir";
    try {
      const raw = patient.birth_date;
      const d = raw.includes("T") ? parseISO(raw) : parseISO(`${raw}T12:00:00`);
      return format(d, "dd/MM/yyyy");
    } catch {
      return patient.birth_date;
    }
  })();

  const insuranceName = patient.insurance_provider ?? "Sin definir";
  const affiliateNumber = patient.insurance_number ?? "Sin definir";

  function toggleFilter(key: FilterKey) {
    setFilters((f) => ({ ...f, [key]: !f[key] }));
  }

  const actionLinks = (
    <div className="drflow-ehr-actions flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--border)] pb-2 text-sm font-semibold">
      <Link
        href={withClinicalHistoryReturn(`/pacientes/${patient.id}`, patient.id)}
        className="drflow-ehr-action-link inline-flex items-center gap-1"
      >
        <Plus className="h-3.5 w-3.5" /> Archivo
      </Link>
      <Link
        href={withClinicalHistoryReturn(`/historias/nueva?patient=${patient.id}`, patient.id)}
        className="drflow-ehr-action-link inline-flex items-center gap-1"
      >
        <Plus className="h-3.5 w-3.5" /> Diagnóstico
      </Link>
      <Link
        href={withClinicalHistoryReturn(`/historias/nueva?patient=${patient.id}`, patient.id)}
        className="drflow-ehr-action-link inline-flex items-center gap-1"
      >
        <Plus className="h-3.5 w-3.5" /> Tratamiento
      </Link>
      <Link
        href={withClinicalHistoryReturn(`/historias/nueva?patient=${patient.id}`, patient.id)}
        className="drflow-ehr-action-link inline-flex items-center gap-1"
      >
        Signos vitales
      </Link>
      <Link
        href={withClinicalHistoryReturn(`/recetas?patient=${patient.id}`, patient.id)}
        className="drflow-ehr-action-link inline-flex items-center gap-1"
      >
        <Plus className="h-3.5 w-3.5" /> Receta
      </Link>
      <Link
        href={withClinicalHistoryReturn(`/recetas?patient=${patient.id}&tipo=orden`, patient.id)}
        className="drflow-ehr-action-link inline-flex items-center gap-1"
      >
        <Plus className="h-3.5 w-3.5" /> Orden
      </Link>
      <button
        type="button"
        onClick={() => window.print()}
        className="drflow-ehr-action-muted ml-auto inline-flex items-center gap-1 print:hidden"
      >
        <Printer className="h-3.5 w-3.5" /> Imprimir
      </button>
    </div>
  );

  return (
    <div className="drflow-ehr-shell min-h-[calc(100vh-10rem)] print:bg-white">
      {/* Barra demográfica */}
      <div className="drflow-ehr-demographics flex flex-wrap border-b border-[var(--border)]">
        <DemographicCell label="Nombre" value={patientFormal} />
        <DemographicCell label="DNI" value={patient.document_number} />
        <DemographicCell label="Edad" value={patient.age_label ?? "Sin definir"} />
        <DemographicCell label="Sexo" value="Sin definir" />
        <DemographicCell label="Obra social" value={insuranceName} />
        <DemographicCell label="N° afiliado" value={affiliateNumber} />
        <DemographicCell
          label="Teléfono"
          value={
            patient.phone ? (
              <span className="inline-flex items-center gap-1">
                {patient.phone}
                <PatientWhatsAppButton
                  phone={patient.phone}
                  message={buildPatientContactMessage(patientDisplay)}
                  size="icon"
                />
              </span>
            ) : (
              "Sin definir"
            )
          }
        />
        <DemographicCell label="Email" value={patient.email?.trim() || "Sin definir"} />
      </div>

      {/* Filtros tipo checkbox */}
      <div className="drflow-ehr-filters flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[var(--border)] px-4 py-2.5">
        {FILTER_OPTIONS.map(({ key, label, icon: Icon }) => (
          <label
            key={key}
            className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium drflow-ehr-filter-label"
          >
            <input
              type="checkbox"
              checked={filters[key]}
              onChange={() => toggleFilter(key)}
              className="h-4 w-4 rounded border-slate-400 text-teal-600 focus:ring-teal-500"
            />
            <Icon className="h-4 w-4 text-teal-600" />
            {label}
          </label>
        ))}
        <span className="ml-auto text-xs drflow-ehr-filter-meta">{totalConsultations} registros</span>
      </div>

      {usesHceExport ? (
        <p className="border-b border-[var(--border)] bg-teal-950/20 px-4 py-2 text-xs text-teal-100">
          Datos parciales del export HCE. Completá con{" "}
          <Link href="/datos" className="font-semibold underline">
            PDF o JSONL
          </Link>
          .
        </p>
      ) : null}

      <div className="drflow-ehr-layout flex flex-col lg:flex-row lg:items-stretch">
        {/* Sidebar evoluciones */}
        {filters.evolutions && (
          <aside className="drflow-ehr-sidebar w-full shrink-0 border-b border-[var(--border)] lg:w-56 lg:border-b-0 lg:border-r">
            <div className="max-h-48 overflow-y-auto lg:max-h-[calc(100vh-16rem)] lg:min-h-[320px]">
              {evolutionList.length === 0 ? (
                <p className="p-4 text-center text-xs drflow-ehr-muted">Sin evoluciones</p>
              ) : (
                <ul>
                  {evolutionList.map((c) => {
                    const active = c.id === selected?.id;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(c.id)}
                          className={cn(
                            "w-full border-b border-[var(--border)] px-3 py-2.5 text-left text-xs transition",
                            active ? "drflow-ehr-sidebar-active" : "drflow-ehr-sidebar-item hover:opacity-90"
                          )}
                        >
                          <p className="font-bold">{formatSidebarDate(c.created_at)}</p>
                          <p className="mt-0.5 truncate font-medium">{c.professional_name}</p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        )}

        {/* Panel principal */}
        <main className="drflow-ehr-main min-w-0 flex-1">
          <div className="p-4">
            {actionLinks}

            {filters.evolutions && (
              <div className="drflow-ehr-evolution-box mt-3 min-h-[240px] rounded-sm border p-4">
                {selected ? (
                  <>
                    <p className="mb-2 text-xs drflow-ehr-muted">
                      {format(new Date(selected.created_at), "EEEE d MMMM yyyy · HH:mm", {
                        locale: es,
                      })}{" "}
                      · {selected.professional_name}
                    </p>
                    <div className="min-h-[180px] whitespace-pre-wrap text-sm leading-relaxed drflow-ehr-evolution-text">
                      {selected.category === "document" ? (
                        <p>
                          {selected.diagnosis?.trim() || selected.chief_complaint || "Documento adjunto"}
                        </p>
                      ) : (
                        evolutionBody(selected)
                      )}
                    </div>
                    {selectedDocumentAttachment ? (
                      <button
                        type="button"
                        onClick={() => void handleOpenAttachment(selectedDocumentAttachment.id)}
                        disabled={openingAttachmentId === selectedDocumentAttachment.id}
                        className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-teal-600 hover:underline disabled:opacity-60"
                      >
                        {openingAttachmentId === selectedDocumentAttachment.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ExternalLink className="h-4 w-4" />
                        )}
                        Abrir {selectedDocumentAttachment.file_name}
                      </button>
                    ) : null}
                    {!selected.id.startsWith("hce-") ? (
                      <Link
                        href={withClinicalHistoryReturn(`/historias/${selected.id}`, patient.id)}
                        className="mt-3 inline-block text-sm font-semibold text-teal-600 hover:underline"
                      >
                        Abrir consulta completa →
                      </Link>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm drflow-ehr-muted">Seleccioná una evolución del listado.</p>
                )}
              </div>
            )}

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {filters.diagnostics && (
                <section className="drflow-ehr-table-panel overflow-hidden rounded-sm border border-[var(--border)]">
                  <h3 className="drflow-ehr-table-title border-b border-[var(--border)] px-3 py-2 text-sm font-bold">
                    Diagnósticos
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="drflow-ehr-table w-full min-w-[280px] text-left text-xs">
                      <thead>
                        <tr>
                          <th className="px-3 py-2 font-semibold">Fecha</th>
                          <th className="px-3 py-2 font-semibold">Nombre</th>
                          <th className="px-3 py-2 font-semibold">Crónico</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diagnosisRows.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-3 py-6 text-center drflow-ehr-muted">
                              Sin diagnósticos
                            </td>
                          </tr>
                        ) : (
                          diagnosisRows.map((row) => (
                            <tr key={row.id} className="border-t border-[var(--border)]">
                              <td className="px-3 py-2 whitespace-nowrap">{row.dateLabel}</td>
                              <td className="px-3 py-2">
                                <Link
                                  href={withClinicalHistoryReturn(
                                    `/historias/${row.recordId}`,
                                    patient.id
                                  )}
                                  className="font-medium text-teal-600 hover:underline"
                                >
                                  {row.name}
                                </Link>
                              </td>
                              <td className="px-3 py-2">
                                {row.chronic ? (
                                  <span className="font-medium text-teal-600">Crónico</span>
                                ) : (
                                  "—"
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {filters.treatments && (
                <section className="drflow-ehr-table-panel overflow-hidden rounded-sm border border-[var(--border)]">
                  <h3 className="drflow-ehr-table-title border-b border-[var(--border)] px-3 py-2 text-sm font-bold">
                    Tratamientos
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="drflow-ehr-table w-full min-w-[320px] text-left text-xs">
                      <thead>
                        <tr>
                          <th className="px-3 py-2 font-semibold">Fecha</th>
                          <th className="px-3 py-2 font-semibold">Producto</th>
                          <th className="px-3 py-2 font-semibold">Dosis</th>
                          <th className="px-3 py-2 font-semibold">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {treatmentRows.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-3 py-6 text-center drflow-ehr-muted">
                              Sin tratamientos
                            </td>
                          </tr>
                        ) : (
                          treatmentRows.map((row) => (
                            <tr key={row.id} className="border-t border-[var(--border)]">
                              <td className="px-3 py-2 whitespace-nowrap">{row.dateLabel}</td>
                              <td className="px-3 py-2">
                                <Link
                                  href={withClinicalHistoryReturn(
                                    `/historias/${row.recordId}`,
                                    patient.id
                                  )}
                                  className="font-medium text-teal-600 hover:underline"
                                >
                                  {row.product}
                                </Link>
                                {row.notes ? (
                                  <p className="mt-0.5 drflow-ehr-muted">{row.notes}</p>
                                ) : null}
                              </td>
                              <td className="px-3 py-2">{row.dose}</td>
                              <td className="px-3 py-2">{row.status}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>

            {filters.vitals && vitalsRows.length > 0 && (
              <section className="mt-4 drflow-ehr-table-panel overflow-hidden rounded-sm border border-[var(--border)]">
                <h3 className="drflow-ehr-table-title border-b border-[var(--border)] px-3 py-2 text-sm font-bold">
                  Signos vitales
                </h3>
                <ul className="divide-y divide-[var(--border)] text-xs">
                  {vitalsRows.map((c) => (
                    <li key={c.id} className="px-3 py-2">
                      <span className="font-semibold">
                        {format(new Date(c.created_at), "d MMM yyyy", { locale: es })}
                      </span>
                      {" — "}
                      {sanitizeClinicalDisplayText(c.evolution || c.chief_complaint) || "—"}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {filters.files && visibleAttachments.length > 0 && (
              <section className="mt-4 drflow-ehr-table-panel overflow-hidden rounded-sm border border-[var(--border)]">
                <h3 className="drflow-ehr-table-title border-b border-[var(--border)] px-3 py-2 text-sm font-bold">
                  Archivos
                </h3>
                {attachmentError ? (
                  <p className="border-b border-[var(--border)] px-3 py-2 text-xs text-red-600">
                    {attachmentError}
                  </p>
                ) : null}
                <ul className="divide-y divide-[var(--border)] text-xs">
                  {visibleAttachments.map((a) => (
                    <li key={a.id} className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => void handleOpenAttachment(a.id)}
                        disabled={openingAttachmentId === a.id}
                        className="inline-flex items-center gap-2 font-medium text-teal-600 hover:underline disabled:opacity-60"
                      >
                        {openingAttachmentId === a.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ExternalLink className="h-3.5 w-3.5" />
                        )}
                        {a.file_name}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {filters.prescriptions && prescriptions.length > 0 && (
              <section className="mt-4 drflow-ehr-table-panel overflow-hidden rounded-sm border border-[var(--border)]">
                <h3 className="drflow-ehr-table-title border-b border-[var(--border)] px-3 py-2 text-sm font-bold">
                  Recetas
                </h3>
                <ul className="divide-y divide-[var(--border)] text-xs">
                  {prescriptions.map((p) => (
                    <li key={p.id} className="px-3 py-2">
                      {p.label}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="mt-6 print:hidden">
              <Link
                href={withClinicalHistoryReturn(`/historias/nueva?patient=${patient.id}`, patient.id)}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-500/20 hover:from-cyan-600 hover:to-teal-600"
              >
                <Plus className="h-4 w-4" /> Nueva consulta
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
