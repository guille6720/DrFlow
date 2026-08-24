"use client";

import { CalendarDays, CheckCircle2, Plus } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CLINICAL_RESEARCH_PROTOCOLS_FLAG } from "@/core/compliance/clinical-research-ai";
import { toast } from "@/core/notifications/toast";

import { cn } from "@/shared/utils/cn";

import { DrappConsultaFullModal } from "@/features/historias/components/consultas/drapp-consulta-full-modal";
import { DrappDiagnosisQuickForm } from "@/features/historias/components/consultas/drapp-diagnosis-quick-form";
import { DrappProtocolsQuickPanel } from "@/features/historias/components/consultas/drapp-protocols-quick-panel";
import { DrappTreatmentQuickForm } from "@/features/historias/components/consultas/drapp-treatment-quick-form";
import { DrappVitalsHistory } from "@/features/historias/components/consultas/drapp-vitals-history";
import { DrappVitalsQuickForm } from "@/features/historias/components/consultas/drapp-vitals-quick-form";
import { useDrappQuickPanel } from "@/features/historias/components/consultas/use-drapp-quick-panel";
import { PatientEhrClinicalTables } from "@/features/historias/components/historias/patient-ehr-clinical-tables";
import { PatientEhrDemographics } from "@/features/historias/components/historias/patient-ehr-demographics";
import { PatientEhrFiltersBar } from "@/features/historias/components/historias/patient-ehr-filters-bar";
import { PatientEhrPrintMenu } from "@/features/historias/components/historias/patient-ehr-print-menu";
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
import type { ClinicalDiagnosisEntry } from "@/features/historias/utils/clinical-structured-entries";
import type { ClinicalTreatmentEntry } from "@/features/historias/utils/clinical-structured-entries";
import {
  type QuickClinicalSaveContext,
  saveFullConsultation,
  saveQuickDiagnosis,
  saveQuickTreatment,
  saveQuickVitals,
} from "@/features/historias/utils/create-quick-clinical-entry";
import {
  formatVitalsForEvolution,
  type VitalsFormValues,
} from "@/features/historias/utils/vitals-form";
import { uploadPatientClinicalDocument } from "@/features/pacientes/actions/patient-attachments";
import type { PatientChartProfessional } from "@/features/pacientes/components/pacientes/patient-chart-view-types";
import type { PatientEhrClinicalRecordsPagination } from "@/features/pacientes/server/load-patient-ehr-data";
import type {
  PatientEhrConsultation,
  PatientEhrDiagnosisRow,
  PatientEhrTreatmentRow,
} from "@/features/pacientes/utils/patient-ehr-model";
import { useFeatureFlag } from "@/features/plugins/components/plugins/clinic-features-provider";

import { Textarea } from "@/components/ui/textarea";
import { EHR_NEW_CONSULT_FORM_ID } from "@/lib/utils/clinical-history-filename";
import { getProfessionalDisplayName } from "@/lib/utils/professional";
import type { Patient } from "@/types/database";
import type { PrescriptionMedication } from "@/types/prescription";

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
  /** Rendered above the consulta shell (inside EHR provider — e.g. nav chips + print). */
  headerSlot?: ReactNode;
};

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
  editingRecordId,
  onEditConsultation,
  onStartNew,
}: {
  sidebarList: PatientEhrConsultation[];
  diagnosisRows: PatientEhrDiagnosisRow[];
  treatmentRows: PatientEhrTreatmentRow[];
  search: string;
  onSearchChange: (value: string) => void;
  pendingLabel: string;
  editingRecordId: string | null;
  onEditConsultation: (consultation: PatientEhrConsultation) => void;
  onStartNew: () => void;
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
    <aside className="drapp-consulta-sidebar flex w-full shrink-0 flex-col border-b border-[var(--border)] bg-[var(--card)] lg:w-[300px] lg:border-b-0 lg:border-r">
      <div className="border-b border-[var(--border)] p-2.5">
        <label className="relative block">
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscador de evoluciones..."
            className="drapp-consulta-search w-full rounded border border-[var(--input)] bg-[var(--card)] py-2 pl-3 pr-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]/40"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-[var(--border)] bg-[var(--muted)] px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[13px] font-semibold text-[var(--primary)]">
                {formatPatientEhrSidebarDate(new Date().toISOString())} {pendingLabel}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-[var(--warning)]">
                {editingRecordId ? "Editando evolución" : "Consulta en curso"}
              </p>
            </div>
            {editingRecordId ? (
              <button
                type="button"
                onClick={onStartNew}
                      className="shrink-0 text-[11px] font-semibold text-[var(--accent)] hover:underline"
              >
                Nueva
              </button>
            ) : null}
          </div>
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
              const isEditing = editingRecordId === c.id;
              return (
                <li
                  key={c.id}
                  className={cn(
                    "border-b border-[var(--border)] px-3 py-3 text-[12px] leading-snug text-[var(--foreground)]",
                    isEditing && "bg-[var(--accent-soft)]"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-[var(--primary)]">
                      {formatPatientEhrSidebarDate(c.created_at)}{" "}
                      <span className="font-medium text-[var(--primary)]">{c.professional_name}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => onEditConsultation(c)}
                      className="shrink-0 text-[11px] font-semibold text-[var(--accent)] hover:underline"
                    >
                      {isEditing ? "Editando" : "Editar"}
                    </button>
                  </div>
                  {body ? (
                    <button
                      type="button"
                      className="mt-2 w-full text-left"
                      onClick={() => onEditConsultation(c)}
                    >
                      <p className="font-semibold text-[var(--foreground)]">Evoluciones</p>
                      <p className="mt-0.5 text-[var(--muted-foreground)]">
                        <span className="text-[var(--muted-foreground)]">{timeLabel}</span> {body}
                      </p>
                    </button>
                  ) : null}
                  {dayDx.length > 0 ? (
                    <div className="mt-2">
                      <p className="font-semibold text-[var(--foreground)]">Diagnósticos</p>
                      <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-[var(--muted-foreground)]">
                        {dayDx.map((d) => (
                          <li key={d.id}>{d.name}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {dayTx.length > 0 ? (
                    <div className="mt-2">
                      <p className="font-semibold text-[var(--foreground)]">Tratamientos</p>
                      <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-[var(--muted-foreground)]">
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
  disabled = false,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  showPlus?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "drapp-consulta-action inline-flex items-center gap-0.5 px-2 py-1 text-[13px] font-medium transition disabled:opacity-50",
        active
          ? "rounded bg-[var(--accent,#0F766E)] text-[var(--accent-foreground,#fff)] shadow-sm"
          : "rounded text-[var(--primary,#0F4C5C)] hover:bg-[var(--accent-soft,#ECFDF5)]"
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
  | "headerSlot"
>) {
  const {
    filters,
    toggleFilter,
    sidebarList,
    diagnosisRows,
    treatmentRows,
    appendClinicalHistory,
  } = usePatientEhrStateContext();

  const [sidebarSearch, setSidebarSearch] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);
  const [fullModalOpen, setFullModalOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [lastSavedRecordId, setLastSavedRecordId] = useState<string | null>(null);
  /** DX/TX of this visit only — never preload the patient's historical tables. */
  const [composerDiagnosisRows, setComposerDiagnosisRows] = useState<PatientEhrDiagnosisRow[]>([]);
  const [composerTreatmentRows, setComposerTreatmentRows] = useState<PatientEhrTreatmentRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const evolutionRef = useRef<HTMLTextAreaElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const quickSaveLock = useRef(false);

  const { openPanel, setDirty, requestOpen, closePanel, markCleanAndClose } =
    useDrappQuickPanel("evolucion");
  const researchProtocolsEnabled = useFeatureFlag(CLINICAL_RESEARCH_PROTOCOLS_FLAG);

  const historySnapshotRef = useRef({
    professionalId: professionalId ?? defaultProfessionalId ?? "",
    professionalName: "Consulta en curso",
    professionalSignature: "",
    chiefComplaint: "",
    evolution: "",
    indications: "",
  });

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
    clinicalTreatments,
    treatmentMedications,
    indications,
    vitals,
    flushEvolutionDraft,
    saveIfDirty,
    professionalSignature,
    editingRecordId,
    autoSaveStatus,
    loadConsultationForEdit,
    startNewConsultation,
  } = useNuevaConsultaForm({
    patients: [patientRecord],
    professionals,
    templates,
    fallbackProfessionalId: defaultProfessionalId ?? undefined,
    workspace: {
      patientId: patient.id,
      appointmentId: appointmentId ?? undefined,
      professionalId: professionalId ?? defaultProfessionalId ?? undefined,
      onSaved: (recordId, silent) => {
        const snap = historySnapshotRef.current;
        appendClinicalHistory({
          consultations: [
            {
              id: recordId,
              created_at: new Date().toISOString(),
              professional_id: snap.professionalId || null,
              professional_signature: snap.professionalSignature || null,
              professional_name: snap.professionalName,
              chief_complaint: snap.chiefComplaint,
              diagnosis: "",
              evolution: snap.evolution,
              indications: snap.indications,
              category: "evolution",
            },
          ],
        });
        setLastSavedRecordId(recordId);
        if (!silent) toast.success("Evolución guardada");
      },
      onClose: () => {},
    },
  });

  const activeProfessionalId =
    formProfessionalId || professionalId || defaultProfessionalId || "";

  const pendingLabel = useMemo(() => {
    const pro = professionals.find((p) => p.id === activeProfessionalId);
    return pro ? getProfessionalDisplayName(pro) : "Consulta en curso";
  }, [activeProfessionalId, professionals]);

  useEffect(() => {
    historySnapshotRef.current = {
      professionalId: activeProfessionalId,
      professionalName: pendingLabel,
      professionalSignature: professionalSignature ?? "",
      chiefComplaint,
      evolution,
      indications,
    };
  }, [
    activeProfessionalId,
    chiefComplaint,
    evolution,
    indications,
    pendingLabel,
    professionalSignature,
  ]);

  const quickCtx = useMemo((): QuickClinicalSaveContext | null => {
    if (!activeProfessionalId) return null;
    return {
      patientId: patient.id,
      professionalId: activeProfessionalId,
      appointmentId,
      professionalName: pendingLabel,
      professionalSignature,
      consultationAtIso: new Date(consultationAt).toISOString(),
    };
  }, [
    activeProfessionalId,
    appointmentId,
    consultationAt,
    patient.id,
    pendingLabel,
    professionalSignature,
  ]);

  const applyQuickResult = useCallback(
    (result: Awaited<ReturnType<typeof saveQuickDiagnosis>>) => {
      if (!result.ok) {
        toast.error(result.error);
        return false;
      }
      appendClinicalHistory({
        consultations: result.consultations,
        diagnosisRows: result.diagnosisRows,
        treatmentRows: result.treatmentRows,
      });
      setLastSavedRecordId(result.recordId);
      if (result.diagnosisRows.length > 0) {
        setComposerDiagnosisRows((prev) => {
          const seen = new Set(prev.map((row) => row.id));
          return [...prev, ...result.diagnosisRows.filter((row) => !seen.has(row.id))];
        });
      }
      if (result.treatmentRows.length > 0) {
        setComposerTreatmentRows((prev) => {
          const seen = new Set(prev.map((row) => row.id));
          return [...prev, ...result.treatmentRows.filter((row) => !seen.has(row.id))];
        });
      }
      toast.success("Guardado");
      markCleanAndClose();
      return true;
    },
    [appendClinicalHistory, markCleanAndClose]
  );

  const runQuickSave = useCallback(
    async (fn: () => Promise<Awaited<ReturnType<typeof saveQuickDiagnosis>>>) => {
      if (quickSaveLock.current || !quickCtx) return;
      quickSaveLock.current = true;
      setQuickSaving(true);
      try {
        const result = await fn();
        applyQuickResult(result);
      } finally {
        quickSaveLock.current = false;
        setQuickSaving(false);
      }
    },
    [applyQuickResult, quickCtx]
  );

  const handleFinalizeClick = useCallback(async () => {
    if (!onFinalize) return;
    const saved = await saveIfDirty({ silent: true });
    if (!saved) return;
    await onFinalize();
  }, [onFinalize, saveIfDirty]);

  const vitalsHistory = useMemo(() => {
    return sidebarList
      .filter((c) => c.category === "vitals" || /signos vitales/i.test(c.chief_complaint + c.evolution))
      .map((c) => ({
        id: c.id,
        created_at: c.created_at,
        text: patientEhrEvolutionBody(c) || c.evolution,
      }));
  }, [sidebarList]);

  async function handleSaveDiagnosis(entry: ClinicalDiagnosisEntry, notes: string) {
    if (!quickCtx) {
      toast.error("Seleccioná un profesional");
      return;
    }
    await runQuickSave(() => saveQuickDiagnosis(quickCtx, entry, notes));
  }

  async function handleSaveTreatment(
    treatment: ClinicalTreatmentEntry,
    medications: PrescriptionMedication[]
  ) {
    if (!quickCtx) {
      toast.error("Seleccioná un profesional");
      return;
    }
    await runQuickSave(() => saveQuickTreatment(quickCtx, treatment, medications));
  }

  async function handleSaveVitals(values: VitalsFormValues) {
    if (!quickCtx) {
      toast.error("Seleccioná un profesional");
      return;
    }
    const text = formatVitalsForEvolution(values);
    await runQuickSave(() => saveQuickVitals(quickCtx, text));
  }

  async function handleSaveFullConsulta(values: {
    chiefComplaint: string;
    evolution: string;
    physicalExam: string;
    indications: string;
    observations: string;
    plan: string;
    diagnoses: ClinicalDiagnosisEntry[];
    clinicalTreatments: ClinicalTreatmentEntry[];
    medications: PrescriptionMedication[];
  }) {
    if (!quickCtx) {
      toast.error("Seleccioná un profesional");
      return;
    }
    await runQuickSave(async () => {
      const result = await saveFullConsultation(quickCtx, {
        ...values,
        vitals,
      });
      if (result.ok) setFullModalOpen(false);
      return result;
    });
  }

  async function handleFileSelected(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.set("patient_id", patient.id);
      formData.set("file", file);
      formData.set("category", "estudio");
      if (lastSavedRecordId) formData.set("clinical_record_id", lastSavedRecordId);
      const result = await uploadPatientClinicalDocument(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Archivo adjunto");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <>
      <div className="sticky top-0 z-20 bg-[var(--card,#fff)]">
        <PatientEhrDemographics patient={patient} totalConsultations={sidebarList.length} />
      </div>
      <PatientEhrFiltersBar
        filters={filters}
        onToggleFilter={toggleFilter}
        totalConsultations={sidebarList.length}
        trailingActions={<PatientEhrPrintMenu triggerLabel="Imprimir historia" />}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <DrappHistorySidebar
          sidebarList={sidebarList}
          diagnosisRows={diagnosisRows}
          treatmentRows={treatmentRows}
          search={sidebarSearch}
          onSearchChange={setSidebarSearch}
          pendingLabel={pendingLabel}
          editingRecordId={editingRecordId}
          onEditConsultation={(c) => {
            loadConsultationForEdit(c);
            setComposerDiagnosisRows(diagnosisRows.filter((row) => row.recordId === c.id));
            setComposerTreatmentRows(treatmentRows.filter((row) => row.recordId === c.id));
            setLastSavedRecordId(c.id);
            requestOpen("evolucion");
            queueMicrotask(() => evolutionRef.current?.focus());
            toast.success("Evolución cargada para editar");
          }}
          onStartNew={() => {
            startNewConsultation();
            setLastSavedRecordId(null);
            setComposerDiagnosisRows([]);
            setComposerTreatmentRows([]);
            requestOpen("evolucion");
          }}
        />

        <main className="drapp-consulta-main min-w-0 flex-1 bg-[var(--card,#fff)] p-3 text-[var(--foreground,#0f172a)] sm:p-4">
          <form
            id={EHR_NEW_CONSULT_FORM_ID}
            ref={formRef}
            onSubmit={handleSubmit}
            onKeyDown={handleFormKeyDown}
            className="space-y-3"
          >
            <input type="hidden" name="patient_id" value={patient.id} />
            <input type="hidden" name="professional_id" value={formProfessionalId} />

            <section
              className={cn(
                "drapp-consulta-composer rounded-sm border border-[var(--border,#e8e0b8)]",
                openPanel === "tratamiento" || openPanel === "diagnostico"
                  ? "overflow-visible"
                  : "overflow-hidden"
              )}
            >
              <div className="drapp-consulta-actions flex flex-wrap items-center gap-1 border-b border-[var(--border,#efe6b8)] px-2 py-1.5">
                <DrappActionLink
                  active={openPanel === "evolucion"}
                  onClick={() => {
                    requestOpen("evolucion");
                    queueMicrotask(() => evolutionRef.current?.focus());
                  }}
                >
                  Evolución
                </DrappActionLink>
                <DrappActionLink
                  active={openPanel === "diagnostico"}
                  onClick={() => requestOpen("diagnostico")}
                >
                  Diagnóstico
                </DrappActionLink>
                <DrappActionLink
                  active={openPanel === "tratamiento"}
                  onClick={() => requestOpen("tratamiento")}
                >
                  Tratamiento
                </DrappActionLink>
                <DrappActionLink
                  active={openPanel === "vitales"}
                  onClick={() => requestOpen("vitales")}
                  showPlus={false}
                >
                  Signos vitales
                </DrappActionLink>
                {researchProtocolsEnabled ? (
                  <DrappActionLink
                    active={openPanel === "protocolos"}
                    onClick={() => requestOpen("protocolos")}
                    showPlus={false}
                  >
                    Protocolos
                  </DrappActionLink>
                ) : null}
                <DrappActionLink
                  active={fullModalOpen}
                  onClick={() => {
                    if (openPanel && openPanel !== "evolucion") {
                      if (!closePanel()) return;
                    }
                    setFullModalOpen(true);
                  }}
                  showPlus={false}
                >
                  Notas/Consulta
                </DrappActionLink>
                <DrappActionLink
                  disabled={uploadingFile}
                  onClick={() => fileInputRef.current?.click()}
                  showPlus={false}
                >
                  {uploadingFile ? "Subiendo…" : "Adjuntar"}
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
                  <span
                    className={cn(
                      "text-[11px]",
                      autoSaveStatus === "error"
                        ? "font-medium text-[var(--destructive,#b91c1c)]"
                        : "text-[var(--muted-foreground,#64748b)]"
                    )}
                  >
                    {autoSaveStatus === "saving"
                      ? "Guardando…"
                      : autoSaveStatus === "saved"
                        ? editingRecordId
                          ? "Autoguardado"
                          : null
                        : autoSaveStatus === "error"
                          ? "Error al guardar"
                          : null}
                  </span>
                  <button
                    type="submit"
                    disabled={formLoading || quickSaving}
                    className="text-[13px] font-semibold text-[var(--primary,#0F4C5C)] hover:underline disabled:opacity-60"
                  >
                    {formLoading
                      ? "Guardando…"
                      : editingRecordId
                        ? "Guardar cambios"
                        : "Guardar"}
                  </button>
                  {onFinalize ? (
                    <button
                      type="button"
                      disabled={finalizing || formLoading || quickSaving}
                      onClick={() => void handleFinalizeClick()}
                      className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--primary)] hover:underline disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {finalizing ? "Finalizando…" : "Finalizar"}
                    </button>
                  ) : null}
                </div>
              </div>

              {openPanel === "diagnostico" ? (
                <DrappDiagnosisQuickForm
                  saving={quickSaving}
                  onDirtyChange={setDirty}
                  onCancel={() => {
                    void closePanel();
                  }}
                  onSave={handleSaveDiagnosis}
                />
              ) : null}

              {openPanel === "tratamiento" ? (
                <DrappTreatmentQuickForm
                  saving={quickSaving}
                  onDirtyChange={setDirty}
                  onCancel={() => {
                    void closePanel();
                  }}
                  onSave={handleSaveTreatment}
                />
              ) : null}

              {openPanel === "vitales" ? (
                <DrappVitalsQuickForm
                  saving={quickSaving}
                  onDirtyChange={setDirty}
                  onCancel={() => {
                    void closePanel();
                  }}
                  onSave={handleSaveVitals}
                />
              ) : null}

              {openPanel === "protocolos" ? (
                <DrappProtocolsQuickPanel
                  onCancel={() => {
                    void closePanel();
                  }}
                  onInsertIntoEvolution={(text) => {
                    const trimmed = evolution.trim();
                    setEvolution(trimmed ? `${trimmed}\n\n${text}` : text);
                    requestOpen("evolucion");
                    queueMicrotask(() => evolutionRef.current?.focus());
                    toast.success("Protocolo insertado en evolución");
                  }}
                />
              ) : null}

              {openPanel === "evolucion" || openPanel === null ? (
                <div className="drapp-consulta-evolution space-y-2 p-3">
                  <Textarea
                    name="chief_complaint"
                    label="Motivo de consulta"
                    rows={2}
                    voiceInput
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                    placeholder="Motivo de la consulta…"
                    className="drapp-consulta-evolution-input border-[var(--input,#e8d98a)] bg-transparent text-[var(--foreground,#0f172a)]"
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
                    className="drapp-consulta-evolution-input min-h-[180px] border-[var(--input,#e8d98a)] bg-transparent text-[14px] leading-relaxed text-[var(--foreground,#0f172a)]"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-[var(--foreground,#0f172a)]">
                      <CalendarDays className="h-4 w-4 text-[var(--primary,#0F4C5C)]" aria-hidden />
                      <span className="font-medium text-[var(--primary,#0F4C5C)]">
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
                        onClick={() =>
                          dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click()
                        }
                      >
                        Cambiar
                      </button>
                    </label>
                  </div>
                </div>
              ) : null}
            </section>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png"
              className="hidden"
              onChange={(e) => void handleFileSelected(e.target.files)}
            />

            {/* Keep structured fields in form state for draft "Guardar" without showing heavy UI */}
            <div className="hidden" aria-hidden>
              <input type="hidden" name="diagnosis" value="" />
              <textarea name="indications" value={indications} readOnly tabIndex={-1} />
              <textarea name="vitals" value={vitals} readOnly tabIndex={-1} />
            </div>

            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          </form>

          <div className="drapp-consulta-tables mt-4 space-y-3">
            <PatientEhrClinicalTables
              patientId={patient.id}
              diagnosisRows={filters.diagnostics ? composerDiagnosisRows : []}
              treatmentRows={filters.treatments ? composerTreatmentRows : []}
              showDiagnostics={filters.diagnostics}
              showTreatments={filters.treatments}
              stacked
            />
            {filters.vitals ? <DrappVitalsHistory items={vitalsHistory} /> : null}
          </div>
        </main>
      </div>

      <DrappConsultaFullModal
        open={fullModalOpen}
        patient={patient}
        saving={quickSaving}
        initial={{
          chiefComplaint,
          evolution,
          diagnoses,
          clinicalTreatments,
          medications: treatmentMedications,
          indications,
        }}
        onClose={() => setFullModalOpen(false)}
        onSave={handleSaveFullConsulta}
      />
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
    headerSlot,
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
      {headerSlot ? <div className="mb-3">{headerSlot}</div> : null}
      <PatientEhrShellFrame>
        <div className="drapp-consulta-shell overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] shadow-sm">
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
