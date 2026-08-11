"use client";

import { Calendar, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import type { PatientEhrTreatmentRow } from "@/features/pacientes/utils/patient-ehr-model";
import { PrescriptionAllergyBanner } from "@/features/recetas/components/recetas/prescription-allergy-banner";
import { PrescriptionDiagnosisFields } from "@/features/recetas/components/recetas/prescription-diagnosis-fields";
import {
  appendPrescriptionMedication,
  emptyPrescriptionMedication,
} from "@/features/recetas/components/recetas/prescription-form-utils";
import {
  mergeVademecumIntoMedication,
  PrescriptionMedicationLineFields,
} from "@/features/recetas/components/recetas/prescription-medication-line-fields";
import { PrescriptionMedicationSearch } from "@/features/recetas/components/recetas/prescription-medication-search";
import {
  type PrescriptionWizardPatient,
  usePrescriptionWizard,
} from "@/features/recetas/hooks/use-prescription-wizard";
import type { CoverageRuleOverridesMap } from "@/features/recetas/utils/coverage-rules-admin";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { insuranceNumberLabel, isPamiCoverage } from "@/lib/constants/coverages";
import { getProfessionalDisplayName } from "@/lib/utils/professional";
import type { PrescriptionMedication } from "@/types/prescription";

interface Professional {
  id: string;
  license_number?: string | null;
  license_national?: string | null;
  license_provincial?: string | null;
  display_name?: string | null;
  profiles?: { full_name: string } | null;
  specialties?: { name: string } | { name: string }[] | null;
}

type CopyMode = "none" | "duplicate" | "triplicate";
type PageSize = "A4" | "A5";

export type PrescriptionSinglePageFormProps = {
  patientId: string;
  patient?: PrescriptionWizardPatient | null;
  patientInsurance?: string | null;
  patientAllergies?: string | null;
  patientAddress?: string | null;
  patientPhone?: string | null;
  clinic?: { name: string; address?: string | null; phone?: string | null };
  clinicalRecordId?: string;
  diagnosisDefault?: string;
  cie10Default?: string;
  notesDefault?: string;
  hceTreatments?: PatientEhrTreatmentRow[];
  professionals: Professional[];
  defaultProfessionalId?: string;
  initialMedications?: PrescriptionMedication[];
  onSuccess?: () => void;
  onCancel?: () => void;
  coverageRuleOverrides?: CoverageRuleOverridesMap | null;
};

function specialtyLabel(
  specialties: Professional["specialties"]
): string | null {
  if (!specialties) return null;
  if (Array.isArray(specialties)) return specialties[0]?.name ?? null;
  return specialties.name ?? null;
}

function professionalLicense(professional: Professional): string {
  return (
    professional.license_number?.trim() ||
    professional.license_national?.trim() ||
    professional.license_provincial?.trim() ||
    ""
  );
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString("es-AR");
}

function toInputDateValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function OptionToggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        {label}
        {description ? (
          <span className="mt-0.5 block text-xs font-normal text-slate-500">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

function CopyPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full border border-teal-600 bg-teal-600 px-4 py-1.5 text-sm font-medium text-white"
          : "rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      }
    >
      {children}
    </button>
  );
}

export function PrescriptionSinglePageForm({
  patientId,
  patient,
  patientInsurance,
  patientAllergies,
  patientAddress,
  patientPhone,
  clinic,
  clinicalRecordId,
  diagnosisDefault = "",
  cie10Default = "",
  notesDefault = "",
  hceTreatments: _hceTreatments = [],
  professionals,
  defaultProfessionalId,
  initialMedications,
  onSuccess,
  onCancel,
  coverageRuleOverrides = null,
}: PrescriptionSinglePageFormProps) {
  const wizard = usePrescriptionWizard({
    patientId,
    patient: patient ?? {
      id: patientId,
      first_name: "",
      last_name: "",
      document_number: "",
      insurance_provider: patientInsurance,
    },
    clinicalRecordId,
    initialMedications,
    diagnosisDefault,
    cie10Default,
    notesDefault,
    professionals,
    defaultProfessionalId,
    onSuccess,
    coverageRuleOverrides,
  });

  const {
    professionalId,
    setProfessionalId,
    setPrescriptionType,
    insuranceNumber,
    setInsuranceNumber,
    insurancePlan,
    setInsurancePlan,
    setNotes,
    diagnosisText,
    setDiagnosisText,
    cie10,
    setCie10,
    medications,
    setMedications,
    updateMed,
    error,
    loading,
    setDisclaimerAccepted,
    setConfirmIssue,
    handleSubmit,
    validateStep,
    selectedProfessional,
    effectiveMedicationSearch,
    effectivePatientInsurance,
    reuseNotice,
  } = wizard;

  const [prescriptionDate, setPrescriptionDate] = useState(() => toInputDateValue(new Date()));
  const [indications, setIndications] = useState(notesDefault);
  const [comments, setComments] = useState("");
  const [editPatient, setEditPatient] = useState(false);
  const [handwrittenSignature, setHandwrittenSignature] = useState(true);
  const [digitalSignature, setDigitalSignature] = useState(false);
  const [includeLogo, setIncludeLogo] = useState(true);
  const [copyMode, setCopyMode] = useState<CopyMode>("none");
  const [pageSize, setPageSize] = useState<PageSize>("A4");
  const [hivFlag, setHivFlag] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const patientDisplay = patient ? `${patient.last_name}, ${patient.first_name}` : "—";
  const affiliateLabel = insuranceNumberLabel(effectivePatientInsurance || null);
  const filledMedications = medications.filter((m) => m.generic_name.trim());
  const existingGenericNames = filledMedications.map((m) => m.generic_name.trim());

  const canGenerate = useMemo(() => {
    const hasMedication = filledMedications.length > 0;
    const hasDiagnosis = Boolean(diagnosisText.trim());
    const hasIndication = Boolean(indications.trim() || comments.trim());
    return (hasMedication && hasDiagnosis) || hasIndication;
  }, [comments, diagnosisText, filledMedications.length, indications]);

  const validationHint =
    !canGenerate && !loading
      ? "Debés agregar al menos un tratamiento junto con un diagnóstico, o dar una indicación."
      : null;

  function applyCopyMode(mode: CopyMode) {
    setCopyMode(mode);
    if (mode === "duplicate") {
      setPrescriptionType("duplicado");
    } else {
      setPrescriptionType("ambulatoria");
    }
  }

  function addMedication(med: PrescriptionMedication) {
    setMedications((prev) => appendPrescriptionMedication(prev, med));
  }

  function removeMedication(index: number) {
    setMedications((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [emptyPrescriptionMedication()];
    });
  }

  async function onGenerate() {
    setSubmitError(null);
    if (!canGenerate) {
      setSubmitError(validationHint);
      return;
    }

    const noteParts = [indications.trim()];
    if (comments.trim()) noteParts.push(comments.trim());
    if (hivFlag) noteParts.unshift("[HIV]");
    if (copyMode === "triplicate") noteParts.push("Triplicado");
    if (pageSize === "A5") noteParts.push("Formato A5");
    if (handwrittenSignature) noteParts.push("Firma manuscrita");
    if (digitalSignature) noteParts.push("Firma digital adjunta");
    if (includeLogo) noteParts.push("Incluir logo");

    setNotes(noteParts.filter(Boolean).join("\n\n"));
    setDisclaimerAccepted(true);
    setConfirmIssue(true);

    const issues = validateStep(3, "issue");
    const blocking = issues.filter((i) => i.severity === "error");
    if (blocking.length > 0) {
      setSubmitError(blocking[0]?.message ?? "Revisá los datos antes de emitir.");
      return;
    }

    await handleSubmit(true);
  }

  return (
    <div className="drflow-prescription-single-page mx-auto max-w-3xl space-y-4 pb-2 text-slate-900">
      {reuseNotice ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {reuseNotice}
        </p>
      ) : null}

      <header className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-[180px] flex-1">
            <p className="text-base font-semibold text-slate-900">
              {selectedProfessional ? getProfessionalDisplayName(selectedProfessional) : "Profesional"}
            </p>
            <p className="text-sm text-slate-600">
              Especialidad: {selectedProfessional ? specialtyLabel(selectedProfessional.specialties) ?? "—" : "—"}
            </p>
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Licencia</label>
            <div className="relative">
              <Select
                value={professionalId}
                onChange={(e) => setProfessionalId(e.target.value)}
                options={professionals.map((p) => ({
                  value: p.id,
                  label: professionalLicense(p)
                    ? `MN ${professionalLicense(p)}`
                    : getProfessionalDisplayName(p),
                }))}
                placeholder="Seleccionar"
              />
            </div>
          </div>
          <div className="min-w-[180px] flex-1 text-sm text-slate-600">
            <span className="font-medium text-slate-700">Dirección:</span>{" "}
            {clinic?.address?.trim() || "—"}
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1 text-sm">
            <p className="text-base font-semibold lowercase text-slate-900">{patientDisplay}</p>
            <p className="text-slate-700">
              <span className="font-medium">DNI:</span> {patient?.document_number ?? "—"}
            </p>
            <p className="text-slate-700">
              <span className="font-medium">Cobertura:</span>{" "}
              {effectivePatientInsurance || "Particular"}
              {insuranceNumber ? ` #${insuranceNumber}` : ""}
            </p>
            <p className="text-slate-700">
              <span className="font-medium">Dirección:</span> {patientAddress?.trim() || "—"}
            </p>
            {patientPhone ? (
              <p className="text-slate-700">
                <span className="font-medium">Teléfono:</span> {patientPhone}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="shrink-0 text-sm font-semibold text-blue-600 hover:text-blue-700"
            onClick={() => setEditPatient((v) => !v)}
          >
            {editPatient ? "Listo" : "Editar"}
          </button>
        </div>
        {editPatient ? (
          <div className="mt-3 grid gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2">
            <Input
              label={affiliateLabel}
              value={insuranceNumber}
              onChange={(e) => setInsuranceNumber(e.target.value)}
            />
            <Input
              label="Plan"
              value={insurancePlan}
              onChange={(e) => setInsurancePlan(e.target.value)}
            />
          </div>
        ) : null}
        {isPamiCoverage(effectivePatientInsurance) ? (
          <p className="mt-2 text-xs font-medium text-teal-800">Cobertura PAMI detectada</p>
        ) : null}
      </section>

      <PrescriptionAllergyBanner allergiesText={patientAllergies} medications={medications} />

      <div className="relative">
        <label htmlFor="rx-date" className="mb-1.5 block text-sm font-medium text-slate-700">
          Fecha
        </label>
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="rx-date"
            type="date"
            value={prescriptionDate}
            onChange={(e) => setPrescriptionDate(e.target.value)}
            className="drflow-ui-input w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 text-sm text-slate-900"
          />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Referencia: {formatDisplayDate(new Date(prescriptionDate + "T12:00:00"))}
        </p>
      </div>

      <PrescriptionDiagnosisFields
        diagnosisText={diagnosisText}
        cie10={cie10}
        onDiagnosisTextChange={setDiagnosisText}
        onCie10Change={setCie10}
      />

      <div className="space-y-2">
        <PrescriptionMedicationSearch
          onAdd={addMedication}
          existingGenericNames={existingGenericNames}
          className="w-full"
        />
      </div>

      {filledMedications.length > 0 ? (
        <div className="space-y-3">
          {medications.map((med, index) =>
            med.generic_name.trim() ? (
              <div
                key={`${med.generic_name}-${index}`}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {index + 1}. {med.generic_name}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeMedication(index)}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-red-600"
                    aria-label="Quitar medicamento"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <PrescriptionMedicationLineFields
                  med={med}
                  index={index}
                  medicationSearch={effectiveMedicationSearch}
                  updateMed={updateMed}
                  applyVademecum={(i, item) => {
                    setMedications((prev) =>
                      prev.map((m, idx) => (idx === i ? mergeVademecumIntoMedication(m, item) : m))
                    );
                  }}
                />
              </div>
            ) : null
          )}
        </div>
      ) : null}

      <Textarea
        label="Indicaciones (opcional)"
        rows={3}
        placeholder="Indicaciones (opcional)"
        value={indications}
        onChange={(e) => setIndications(e.target.value)}
      />

      <Textarea
        label="Comentarios (opcional)"
        rows={3}
        placeholder="Comentarios (opcional)"
        value={comments}
        onChange={(e) => setComments(e.target.value)}
      />

      <div className="space-y-2">
        <OptionToggle
          checked={handwrittenSignature}
          onChange={setHandwrittenSignature}
          label="Firma manuscrita"
        />
        <OptionToggle
          checked={digitalSignature}
          onChange={setDigitalSignature}
          label="Adjuntar firma digital (opcional)"
        />
        <OptionToggle
          checked={includeLogo}
          onChange={setIncludeLogo}
          label="Incluir logo"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <CopyPill active={copyMode === "none"} onClick={() => applyCopyMode("none")}>
          Sin copia
        </CopyPill>
        <CopyPill active={copyMode === "duplicate"} onClick={() => applyCopyMode("duplicate")}>
          Duplicado
        </CopyPill>
        <CopyPill active={copyMode === "triplicate"} onClick={() => applyCopyMode("triplicate")}>
          Triplicado
        </CopyPill>
        <span className="mx-1 hidden h-6 w-px bg-slate-300 sm:inline-block" aria-hidden />
        <CopyPill active={pageSize === "A4"} onClick={() => setPageSize("A4")}>
          A4
        </CopyPill>
        <CopyPill active={pageSize === "A5"} onClick={() => setPageSize("A5")}>
          A5
        </CopyPill>
        <label className="ml-1 inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300"
            checked={hivFlag}
            onChange={(e) => setHivFlag(e.target.checked)}
          />
          HIV
        </label>
      </div>

      {(submitError || error) && (
        <p className="text-sm font-medium text-red-600" role="alert">
          {submitError || error}
        </p>
      )}

      {validationHint && !submitError && !error ? (
        <p className="text-sm text-red-600">{validationHint}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
        <Button
          type="button"
          loading={loading}
          disabled={!canGenerate || loading}
          onClick={() => void onGenerate()}
          className="min-w-[160px]"
        >
          Generar receta
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
            Cerrar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
