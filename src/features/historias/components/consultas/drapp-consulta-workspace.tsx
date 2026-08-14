"use client";

import { CheckCircle2, FileText, Plus, Search } from "lucide-react";
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

function truncate(text: string, max = 140): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
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
    <aside className="drapp-consulta-sidebar flex w-full shrink-0 flex-col border-b border-slate-200 bg-white lg:w-[280px] lg:border-b-0 lg:border-r">
      <div className="border-b border-slate-200 p-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscador de evoluciones..."
            className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-8 pr-2 text-xs text-slate-800 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-300"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-sky-100 bg-sky-50 px-3 py-2.5">
          <p className="text-xs font-bold text-sky-800">{pendingLabel}</p>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-600">
            Consulta en curso
          </p>
        </div>
        {filtered.length === 0 ? (
          <p className="p-4 text-center text-xs text-slate-500">Sin evoluciones previas</p>
        ) : (
          <ul>
            {filtered.map((c) => {
              const dayDx = diagnosisRows
                .filter((d) => isSameCalendarDay(d.recordCreatedAt, c.created_at))
                .slice(0, 3);
              const dayTx = treatmentRows
                .filter((t) => isSameCalendarDay(t.recordCreatedAt, c.created_at))
                .slice(0, 4);
              return (
                <li key={c.id} className="border-b border-slate-100 px-3 py-3 text-xs text-slate-700">
                  <p className="font-bold text-sky-700">{formatPatientEhrSidebarDate(c.created_at)}</p>
                  <p className="mt-1 leading-relaxed text-slate-600">
                    {truncate(patientEhrEvolutionBody(c), 160)}
                  </p>
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
                            {t.dose ? ` · ${t.dose}` : ""}
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
}: Omit<Props, "consultations" | "diagnosisRows" | "treatmentRows" | "attachments" | "prescriptions" | "totalConsultations" | "usesHceExport" | "clinicalRecordsPagination" | "embedded">) {
  const router = useRouter();
  const {
    filters,
    toggleFilter,
    sidebarList,
    diagnosisRows,
    treatmentRows,
  } = usePatientEhrStateContext();

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
    const pro = professionals.find((p) => p.id === (formProfessionalId || professionalId || defaultProfessionalId));
    return pro ? getProfessionalDisplayName(pro) : "Consulta en curso";
  }, [defaultProfessionalId, formProfessionalId, professionalId, professionals]);

  const pillClass = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
      active
        ? "border-sky-500 bg-sky-600 text-white shadow-sm"
        : "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100"
    );

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
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button type="button" className={pillClass(activeFocus === "evolucion")} onClick={() => focusSection("evolucion")}>
              <Plus className="h-3.5 w-3.5" /> Evolución
            </button>
            <button type="button" className={pillClass(activeFocus === "archivo")} onClick={() => focusSection("archivo")}>
              <Plus className="h-3.5 w-3.5" /> Archivo
            </button>
            <button type="button" className={pillClass(activeFocus === "diagnostico")} onClick={() => focusSection("diagnostico")}>
              <Plus className="h-3.5 w-3.5" /> Diagnóstico
            </button>
            <button type="button" className={pillClass(activeFocus === "tratamiento")} onClick={() => focusSection("tratamiento")}>
              <Plus className="h-3.5 w-3.5" /> Tratamiento
            </button>
            <button type="button" className={pillClass(activeFocus === "medicacion")} onClick={() => focusSection("medicacion")}>
              <Plus className="h-3.5 w-3.5" /> Medicación
            </button>
            <button type="button" className={pillClass(activeFocus === "vitales")} onClick={() => focusSection("vitales")}>
              Signos vitales
            </button>
            {canIssue ? (
              <button
                type="button"
                className={pillClass(false)}
                onClick={() => {
                  flushEvolutionDraft();
                  onOpenSheet?.("receta");
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Receta
              </button>
            ) : null}
            {canIssue ? (
              <button type="button" className={pillClass(false)} onClick={() => onOpenSheet?.("orden")}>
                <FileText className="h-3.5 w-3.5" /> Orden
              </button>
            ) : null}

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button type="submit" form={EHR_NEW_CONSULT_FORM_ID} size="sm" loading={formLoading}>
                Guardar evolución
              </Button>
              {onFinalize ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  loading={finalizing || formLoading}
                  onClick={() => void handleFinalizeClick()}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Finalizar consulta
                </Button>
              ) : null}
            </div>
          </div>

          <form
            id={EHR_NEW_CONSULT_FORM_ID}
            ref={formRef}
            onSubmit={handleSubmit}
            onKeyDown={handleFormKeyDown}
            className="space-y-4"
          >
            <input type="hidden" name="patient_id" value={patient.id} />
            <input type="hidden" name="professional_id" value={formProfessionalId} />

            <section id="ehr-consult-evolucion" className="drapp-consulta-evolution rounded-md border border-amber-200 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-amber-900">Evolución</p>
                <p className="text-[11px] text-amber-800/80">
                  {consultationAt
                    ? new Date(consultationAt).toLocaleString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : null}
                </p>
              </div>
              <div className="space-y-3">
                <Textarea
                  name="chief_complaint"
                  label="Motivo de consulta"
                  rows={2}
                  voiceInput
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="Motivo de la consulta…"
                  className="border-amber-200 bg-[#fffdf3] text-slate-900"
                />
                <Textarea
                  ref={evolutionRef}
                  name="evolution"
                  label="Examen / evolución"
                  required
                  rows={6}
                  voiceInput
                  value={evolution}
                  onChange={(e) => setEvolution(e.target.value)}
                  placeholder="Escribí aquí el examen y la evolución."
                  className="drapp-consulta-evolution-input min-h-[160px] border-amber-200 bg-[#fff8dc] text-slate-900"
                />
              </div>
            </section>

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

            {showVitals ? (
              <section id="ehr-consult-vitales">
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
                className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3"
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

          <div className="mt-4">
            <PatientEhrClinicalTables
              patientId={patient.id}
              diagnosisRows={
                filters.diagnostics
                  ? diagnosisRows
                  : []
              }
              treatmentRows={filters.treatments ? treatmentRows : []}
              showDiagnostics={filters.diagnostics}
              showTreatments={filters.treatments}
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
