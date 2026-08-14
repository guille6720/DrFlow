"use client";

import { CalendarDays, CheckCircle2, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/shared/utils/cn";

import { ConsultEvolutionStructuredFields } from "@/features/historias/components/historias/consult-evolution-structured-fields";
import { PatientEhrClinicalTables } from "@/features/historias/components/historias/patient-ehr-clinical-tables";
import { PatientEhrDemographics } from "@/features/historias/components/historias/patient-ehr-demographics";
import { PatientEhrFiltersBar } from "@/features/historias/components/historias/patient-ehr-filters-bar";
import { PatientEhrShellFrame } from "@/features/historias/components/historias/patient-ehr-shell-frame";
import {
  PatientEhrStateProvider,
  usePatientEhrStateContext,
} from "@/features/historias/components/historias/patient-ehr-state-context";
import type { PatientEhrViewProps } from "@/features/historias/components/historias/patient-ehr-types";
import {
  formatPatientEhrSidebarDate,
  isSameCalendarDay,
  patientEhrEvolutionBody,
} from "@/features/historias/components/historias/patient-ehr-utils";
import { useNuevaConsultaForm } from "@/features/historias/hooks/use-nueva-consulta-form";
import type { PatientChartProfessional } from "@/features/pacientes/components/pacientes/patient-chart-view-types";
import type { PatientEhrClinicalRecordsPagination } from "@/features/pacientes/server/load-patient-ehr-data";
import type {
  PatientEhrConsultation,
  PatientEhrDiagnosisRow,
  PatientEhrTreatmentRow,
} from "@/features/pacientes/utils/patient-ehr-model";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EHR_NEW_CONSULT_FORM_ID } from "@/lib/utils/clinical-history-filename";
import { getProfessionalDisplayName } from "@/lib/utils/professional";
import type { Patient } from "@/types/database";

type Template = {
  id: string;
  name: string;
  chief_complaint_template: string | null;
  diagnosis_template: string | null;
  evolution_template: string | null;
  indications_template: string | null;
};

type Props = PatientEhrViewProps & {
  patientRecord: Patient;
  professionals: PatientChartProfessional[];
  templates: Template[];
  defaultProfessionalId?: string | null;
  clinicalRecordsPagination?: PatientEhrClinicalRecordsPagination;
  canIssue?: boolean;
  appointmentId?: string | null;
  professionalId?: string | null;
  onOpenSheet?: (sheet: "receta" | "orden" | "archivo") => void;
  onFinalize?: () => void | Promise<void>;
  finalizing?: boolean;
};

type FocusSection = "evolucion" | "diagnostico" | "tratamiento" | "medicacion" | "vitales" | "archivo";

function truncate(text: string, max = 180): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function formatConsultationDateLabel(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function DrappHistorySidebar({
  sidebarList,
  diagnosisRows,
  treatmentRows,
  search,
  onSearchChange,
  pendingLabel,
}: {
  sidebarList: PatientEhrConsultation[];
  diagnosisRows: PatientEhrDiagnosisRow[];
  treatmentRows: PatientEhrTreatmentRow[];
  search: string;
  onSearchChange: (value: string) => void;
  pendingLabel: string;
}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sidebarList;
    return sidebarList.filter((c) => {
      const hay = `${c.evolution} ${c.diagnosis} ${c.chief_complaint} ${c.professional_name}`.toLowerCase();
      return hay.includes(q);
    });
  }, [search, sidebarList]);

  return (
    <aside className="drapp-consulta-sidebar flex w-full shrink-0 flex-col border-b border-slate-200 bg-white lg:w-[300px] lg:border-b-0 lg:border-r">
      <div className="border-b border-slate-200 p-2.5">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscador de evoluciones..."
            className="drapp-consulta-search w-full rounded border border-slate-200 bg-white py-2 pl-8 pr-2 text-xs text-slate-800 outline-none focus:border-[#5ba4e6] focus:ring-1 focus:ring-[#5ba4e6]/40"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-slate-100 px-3 py-2.5">
          <p className="text-[13px] font-semibold text-[#2f7fbf]">
            {formatPatientEhrSidebarDate(new Date().toISOString())} {pendingLabel}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">Consulta en curso</p>
        </div>
        {filtered.length === 0 ? (
          <p className="p-4 text-center text-xs text-slate-500">Sin evoluciones previas</p>
        ) : (
          <ul>
            {filtered.map((c) => {
              const dayDx = diagnosisRows
                .filter((d) => isSameCalendarDay(d.recordCreatedAt, c.created_at))
                .slice(0, 6);
              const dayTx = treatmentRows
                .filter((t) => isSameCalendarDay(t.recordCreatedAt, c.created_at))
                .slice(0, 8);
              const body = truncate(patientEhrEvolutionBody(c), 220);
              const timeLabel = new Date(c.created_at).toLocaleTimeString("es-AR", {
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <li key={c.id} className="border-b border-slate-100 px-3 py-3 text-[12px] leading-snug text-slate-700">
                  <p className="font-semibold text-[#2f7fbf]">
                    {formatPatientEhrSidebarDate(c.created_at)}{" "}
                    <span className="font-medium text-[#2f7fbf]/90">{c.professional_name}</span>
                  </p>
                  {body ? (
                    <div className="mt-2">
                      <p className="font-semibold text-slate-800">Evoluciones</p>
                      <p className="mt-0.5 text-slate-600">
                        <span className="text-slate-400">{timeLabel}</span> {body}
                      </p>
                    </div>
                  ) : null}
                  {dayDx.length > 0 ? (
                    <div className="mt-2">
                      <p className="font-semibold text-slate-800">Diagnósticos</p>
                      <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-slate-600">
                        {dayDx.map((d) => (
                          <li key={d.id}>{d.name}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {dayTx.length > 0 ? (
                    <div className="mt-2">
                      <p className="font-semibold text-slate-800">Tratamientos</p>
                      <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-slate-600">
                        {dayTx.map((t) => (
                          <li key={t.id}>
                            {t.product}
                            {t.dose ? ` ${t.dose}` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

function DrappActionLink({
  active,
  onClick,
  children,
  showPlus = true,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  showPlus?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "drapp-consulta-action inline-flex items-center gap-0.5 px-2 py-1 text-[13px] font-medium transition",
        active
          ? "rounded bg-[#4f9fe0] text-white shadow-sm"
          : "rounded text-[#2f7fbf] hover:bg-[#e8f4fc]"
      )}
    >
      {showPlus ? <Plus className="h-3.5 w-3.5" strokeWidth={2.25} /> : null}
      {children}
    </button>
  );
}

function DrappConsultaWorkspaceInner({
  patient,
  patientRecord,
  professionals,
  templates,
  defaultProfessionalId,
  canIssue = false,
  appointmentId = null,
  professionalId = null,
  onOpenSheet,
  onFinalize,
  finalizing = false,
}: Omit<
  Props,
  | "consultations"
  | "diagnosisRows"
  | "treatmentRows"
  | "attachments"
  | "prescriptions"
  | "totalConsultations"
  | "usesHceExport"
  | "clinicalRecordsPagination"
  | "embedded"
>) {
  const router = useRouter();
  const { filters, toggleFilter, sidebarList, diagnosisRows, treatmentRows } =
    usePatientEhrStateContext();

  const [sidebarSearch, setSidebarSearch] = useState("");
  const [activeFocus, setActiveFocus] = useState<FocusSection>("evolucion");
  const [showVitals, setShowVitals] = useState(false);
  const [showArchivo, setShowArchivo] = useState(false);

  const evolutionRef = useRef<HTMLTextAreaElement>(null);
  const diagnosisAnchorRef = useRef<HTMLDivElement>(null);
  const diagnosisSearchRef = useRef<HTMLInputElement>(null);
  const treatmentSearchRef = useRef<HTMLInputElement>(null);
  const medicationSearchRef = useRef<HTMLInputElement>(null);
  const vitalsRef = useRef<HTMLTextAreaElement>(null);
  const archivoRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const onConsultSaved = useCallback(() => {
    router.refresh();
  }, [router]);

  const {
    formRef,
    handleSubmit,
    handleFormKeyDown,
    loading: formLoading,
    error: formError,
    professionalId: formProfessionalId,
    consultationAt,
    setConsultationAt,
    chiefComplaint,
    setChiefComplaint,
    evolution,
    setEvolution,
    diagnoses,
    setDiagnoses,
    clinicalTreatments,
    setClinicalTreatments,
    treatmentMedications,
    setTreatmentMedications,
    indications,
    setIndications,
    vitals,
    setVitals,
    flushEvolutionDraft,
    saveIfDirty,
  } = useNuevaConsultaForm({
    patients: [patientRecord],
    professionals,
    templates,
    fallbackProfessionalId: defaultProfessionalId ?? undefined,
    workspace: {
      patientId: patient.id,
      appointmentId: appointmentId ?? undefined,
      professionalId: professionalId ?? defaultProfessionalId ?? undefined,
      onSaved: onConsultSaved,
      onClose: () => {},
    },
  });

  const handleFinalizeClick = useCallback(async () => {
    if (!onFinalize) return;
    const saved = await saveIfDirty({ silent: true });
    if (!saved) return;
    await onFinalize();
  }, [onFinalize, saveIfDirty]);

  const focusSection = useCallback((section: FocusSection) => {
    setActiveFocus(section);
    if (section === "vitales") setShowVitals(true);
    if (section === "archivo") setShowArchivo(true);
    queueMicrotask(() => {
      const map: Record<FocusSection, HTMLElement | null | undefined> = {
        evolucion: evolutionRef.current,
        diagnostico: diagnosisSearchRef.current ?? diagnosisAnchorRef.current,
        tratamiento: treatmentSearchRef.current,
        medicacion: medicationSearchRef.current,
        vitales: vitalsRef.current,
        archivo: archivoRef.current,
      };
      const el = map[section];
      el?.focus();
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  useEffect(() => {
    queueMicrotask(() => focusSection("evolucion"));
  }, [focusSection]);

  const pendingLabel = useMemo(() => {
    const pro = professionals.find(
      (p) => p.id === (formProfessionalId || professionalId || defaultProfessionalId)
    );
    return pro ? getProfessionalDisplayName(pro) : "Consulta en curso";
  }, [defaultProfessionalId, formProfessionalId, professionalId, professionals]);

  return (
    <>
      <PatientEhrDemographics patient={patient} />
      <PatientEhrFiltersBar
        filters={filters}
        onToggleFilter={toggleFilter}
        totalConsultations={sidebarList.length}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <DrappHistorySidebar
          sidebarList={sidebarList}
          diagnosisRows={diagnosisRows}
          treatmentRows={treatmentRows}
          search={sidebarSearch}
          onSearchChange={setSidebarSearch}
          pendingLabel={pendingLabel}
        />

        <main className="drapp-consulta-main min-w-0 flex-1 bg-white p-3 sm:p-4">
          <form
            id={EHR_NEW_CONSULT_FORM_ID}
            ref={formRef}
            onSubmit={handleSubmit}
            onKeyDown={handleFormKeyDown}
            className="space-y-3"
          >
            <input type="hidden" name="patient_id" value={patient.id} />
            <input type="hidden" name="professional_id" value={formProfessionalId} />

            <section className="drapp-consulta-composer overflow-hidden rounded-sm border border-[#e8e0b8]">
              <div className="drapp-consulta-actions flex flex-wrap items-center gap-1 border-b border-[#efe6b8] px-2 py-1.5">
                <DrappActionLink
                  active={activeFocus === "evolucion"}
                  onClick={() => focusSection("evolucion")}
                >
                  Evolución
                </DrappActionLink>
                <DrappActionLink
                  active={activeFocus === "archivo"}
                  onClick={() => focusSection("archivo")}
                >
                  Archivo
                </DrappActionLink>
                <DrappActionLink
                  active={activeFocus === "diagnostico"}
                  onClick={() => focusSection("diagnostico")}
                >
                  Diagnóstico
                </DrappActionLink>
                <DrappActionLink
                  active={activeFocus === "tratamiento"}
                  onClick={() => focusSection("tratamiento")}
                >
                  Tratamiento
                </DrappActionLink>
                <DrappActionLink
                  active={activeFocus === "medicacion"}
                  onClick={() => focusSection("medicacion")}
                >
                  Medicación
                </DrappActionLink>
                <DrappActionLink
                  active={activeFocus === "vitales"}
                  onClick={() => focusSection("vitales")}
                  showPlus={false}
                >
                  Signos vitales
                </DrappActionLink>
                {canIssue ? (
                  <DrappActionLink
                    onClick={() => {
                      flushEvolutionDraft();
                      onOpenSheet?.("receta");
                    }}
                  >
                    Receta
                  </DrappActionLink>
                ) : null}
                {canIssue ? (
                  <DrappActionLink onClick={() => onOpenSheet?.("orden")}>Orden</DrappActionLink>
                ) : null}

                <div className="ml-auto flex flex-wrap items-center gap-2 px-1">
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="text-[13px] font-semibold text-[#2f7fbf] hover:underline disabled:opacity-60"
                  >
                    {formLoading ? "Guardando…" : "Guardar"}
                  </button>
                  {onFinalize ? (
                    <button
                      type="button"
                      disabled={finalizing || formLoading}
                      onClick={() => void handleFinalizeClick()}
                      className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#2f7fbf] hover:underline disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {finalizing ? "Finalizando…" : "Finalizar"}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="drapp-consulta-evolution space-y-2 p-3">
                <Textarea
                  name="chief_complaint"
                  label="Motivo de consulta"
                  rows={2}
                  voiceInput
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="Motivo de la consulta…"
                  className="drapp-consulta-evolution-input border-[#e8d98a] bg-transparent text-slate-900"
                />
                <Textarea
                  ref={evolutionRef}
                  name="evolution"
                  label="Evolución"
                  required
                  rows={8}
                  voiceInput
                  value={evolution}
                  onChange={(e) => setEvolution(e.target.value)}
                  placeholder="Escribe aquí la evolución"
                  className="drapp-consulta-evolution-input min-h-[180px] border-[#e8d98a] bg-transparent text-[14px] leading-relaxed text-slate-900"
                />

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-slate-700">
                    <CalendarDays className="h-4 w-4 text-[#2f7fbf]" aria-hidden />
                    <span className="font-medium text-[#2f7fbf]">
                      {formatConsultationDateLabel(consultationAt)}
                    </span>
                    <input
                      ref={dateInputRef}
                      type="datetime-local"
                      value={consultationAt}
                      onChange={(e) => setConsultationAt(e.target.value)}
                      className="sr-only"
                      tabIndex={-1}
                    />
                    <button
                      type="button"
                      className="text-[12px] text-slate-500 underline-offset-2 hover:underline"
                      onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click()}
                    >
                      Cambiar
                    </button>
                  </label>
                </div>
              </div>
            </section>

            <div className="drapp-consulta-structured rounded-sm border border-slate-200 bg-white p-3">
              <ConsultEvolutionStructuredFields
                diagnoses={diagnoses}
                onDiagnosesChange={setDiagnoses}
                clinicalTreatments={clinicalTreatments}
                onClinicalTreatmentsChange={setClinicalTreatments}
                medications={treatmentMedications}
                onMedicationsChange={setTreatmentMedications}
                indications={indications}
                onIndicationsChange={setIndications}
                diagnosisHighlighted={activeFocus === "diagnostico"}
                treatmentHighlighted={activeFocus === "tratamiento"}
                medicationHighlighted={activeFocus === "medicacion"}
                diagnosisSearchRef={diagnosisSearchRef}
                treatmentSearchRef={treatmentSearchRef}
                medicationSearchRef={medicationSearchRef}
                diagnosisAnchorRef={diagnosisAnchorRef}
              />
            </div>

            {showVitals ? (
              <section id="ehr-consult-vitales" className="rounded-sm border border-slate-200 p-3">
                <Textarea
                  ref={vitalsRef}
                  label="Signos vitales"
                  rows={2}
                  voiceInput
                  value={vitals}
                  onChange={(e) => setVitals(e.target.value)}
                  placeholder="TA, FC, FR, T°, Sat O₂, peso..."
                />
              </section>
            ) : null}

            {showArchivo ? (
              <section
                id="ehr-consult-archivo"
                className="rounded-sm border border-dashed border-slate-300 bg-slate-50 p-3"
              >
                <p className="mb-2 text-xs font-semibold text-slate-600">Archivo adjunto</p>
                <Button type="button" variant="outline" size="sm" onClick={() => onOpenSheet?.("archivo")}>
                  <Plus className="h-4 w-4" />
                  Subir archivo
                </Button>
                <input ref={archivoRef} type="text" className="sr-only" readOnly tabIndex={-1} />
              </section>
            ) : null}

            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          </form>

          <div className="drapp-consulta-tables mt-4">
            <PatientEhrClinicalTables
              patientId={patient.id}
              diagnosisRows={filters.diagnostics ? diagnosisRows : []}
              treatmentRows={filters.treatments ? treatmentRows : []}
              showDiagnostics={filters.diagnostics}
              showTreatments={filters.treatments}
              stacked
            />
          </div>
        </main>
      </div>
    </>
  );
}

export function DrappConsultaWorkspace(props: Props) {
  const {
    consultations,
    diagnosisRows,
    treatmentRows,
    attachments,
    patient,
    clinicalRecordsPagination,
    professionals,
    ...rest
  } = props;

  return (
    <PatientEhrStateProvider
      consultations={consultations}
      attachments={attachments}
      patient={patient}
      diagnosisRows={diagnosisRows}
      treatmentRows={treatmentRows}
      patientId={patient.id}
      clinicalRecordsPagination={clinicalRecordsPagination}
      professionals={professionals}
    >
      <PatientEhrShellFrame>
        <div className="drapp-consulta-shell overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <DrappConsultaWorkspaceInner
            key={`${patient.id}:${rest.appointmentId ?? ""}`}
            {...rest}
            patient={patient}
            professionals={professionals}
          />
        </div>
      </PatientEhrShellFrame>
    </PatientEhrStateProvider>
  );
}
