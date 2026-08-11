"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect } from "react";

import type { PatientEhrTreatmentRow } from "@/features/pacientes/utils/patient-ehr-model";
import { PrescriptionClinicalAssistPanel } from "@/features/recetas/components/recetas/prescription-clinical-assist-panel";
import { PrescriptionDiagnosisFields } from "@/features/recetas/components/recetas/prescription-diagnosis-fields";
import {
  PrescriptionFormSection,
  PrescriptionReadonlyField,
} from "@/features/recetas/components/recetas/prescription-form-section";
import { PrescriptionMedicationsSection } from "@/features/recetas/components/recetas/prescription-medications-section";
import { PrescriptionTemplatePicker } from "@/features/recetas/components/recetas/prescription-template-picker";
import {
  type PrescriptionWizardPatient,
  usePrescriptionWizard,
} from "@/features/recetas/hooks/use-prescription-wizard";
import type { CoverageRuleOverridesMap } from "@/features/recetas/utils/coverage-rules-admin";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { coverageOptionsForClinic, isPamiCoverage } from "@/lib/constants/coverages";
import { getProfessionalDisplayName } from "@/lib/utils/professional";
import type { PathologySearchResult } from "@/types/pharmacology";
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

interface Props {
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
  coverageRuleOverrides?: CoverageRuleOverridesMap | null;
}

const STEP_LABELS = ["Datos", "Tratamiento", "Emitir"] as const;

function professionalLicense(professional: Professional): string {
  return (
    professional.license_number?.trim() ||
    professional.license_national?.trim() ||
    professional.license_provincial?.trim() ||
    ""
  );
}

function specialtyLabel(
  specialties: Professional["specialties"]
): string | null {
  if (!specialties) return null;
  if (Array.isArray(specialties)) return specialties[0]?.name ?? null;
  return specialties.name ?? null;
}

export function PrescriptionWizard({
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
  hceTreatments = [],
  professionals,
  defaultProfessionalId,
  initialMedications,
  onSuccess,
  coverageRuleOverrides = null,
}: Props) {
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
    step,
    goNext,
    goBack,
    professionalId,
    setProfessionalId,
    prescriptionType,
    setPrescriptionType,
    setPatientInsurance,
    insuranceNumber,
    setInsuranceNumber,
    insurancePlan,
    setInsurancePlan,
    validityDays,
    setValidityDays,
    notes,
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
    disclaimerAccepted,
    setDisclaimerAccepted,
    confirmIssue,
    setConfirmIssue,
    handleSubmit,
    affiliateLabel,
    planOptions,
    selectedProfessional,
    buildDraftInput,
    applyTemplate,
    saveAsTemplate,
    templateMessage,
    templateSaving,
    saveTemplateName,
    setSaveTemplateName,
    reuseNotice,
    coverageInfoMessages,
    effectiveMedicationSearch,
    insuranceLocked,
    authoritativeCoverageKind,
    effectivePatientInsurance,
  } = wizard;

  const handlePathologySelect = useCallback(
    (pathology: PathologySearchResult) => {
      if (!cie10.trim()) setCie10(pathology.cie10_code);
      if (!diagnosisText.trim()) setDiagnosisText(pathology.name);
    },
    [cie10, diagnosisText, setCie10, setDiagnosisText]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (step !== 3 || loading) return;
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        void handleSubmit(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [step, loading, handleSubmit]);

  const coverageOptions = coverageOptionsForClinic(null, effectivePatientInsurance);
  const draftPreview = buildDraftInput(true);
  const patientDisplay = patient
    ? `${patient.last_name}, ${patient.first_name}`
    : null;
  const todayLabel = new Date().toLocaleDateString("es-AR");

  return (
    <div className="drflow-prescription-wizard space-y-5 text-slate-900">
      <nav aria-label="Pasos de la receta" className="flex flex-wrap gap-2">
        {STEP_LABELS.map((label, index) => {
          const n = (index + 1) as 1 | 2 | 3;
          const active = step === n;
          const done = step > n;
          return (
            <div
              key={label}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                active
                  ? "bg-teal-600 text-white"
                  : done
                    ? "bg-teal-100 text-teal-800"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {n}. {label}
            </div>
          );
        })}
      </nav>

      {reuseNotice ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {reuseNotice}
        </p>
      ) : null}

      {templateMessage ? (
        <p className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
          {templateMessage}
        </p>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          <PrescriptionFormSection title="Profesional">
            <Select
              label="Profesional prescriptor"
              required
              value={professionalId}
              onChange={(e) => setProfessionalId(e.target.value)}
              options={professionals.map((p) => ({
                value: p.id,
                label: `${getProfessionalDisplayName(p)}${
                  professionalLicense(p) ? ` — Mat. ${professionalLicense(p)}` : ""
                }`,
              }))}
              placeholder="Seleccionar"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <PrescriptionReadonlyField
                label="Nombre"
                value={
                  selectedProfessional ? getProfessionalDisplayName(selectedProfessional) : null
                }
              />
              <PrescriptionReadonlyField
                label="Especialidad"
                value={
                  selectedProfessional
                    ? specialtyLabel(selectedProfessional.specialties)
                    : null
                }
              />
              <PrescriptionReadonlyField
                label="Matrícula"
                value={selectedProfessional ? professionalLicense(selectedProfessional) : null}
              />
              <PrescriptionReadonlyField label="Institución" value={clinic?.name} />
            </div>
            {clinic?.address || clinic?.phone ? (
              <p className="text-xs text-slate-600">
                {[clinic.address, clinic.phone].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </PrescriptionFormSection>

          <PrescriptionFormSection title="Paciente">
            <div className="grid gap-4 sm:grid-cols-2">
              <PrescriptionReadonlyField label="Nombre y apellido" value={patientDisplay} />
              <PrescriptionReadonlyField label="DNI" value={patient?.document_number} />
              <PrescriptionReadonlyField
                label="Cobertura"
                value={effectivePatientInsurance || "Particular"}
              />
              <PrescriptionReadonlyField label={affiliateLabel} value={insuranceNumber} />
              <PrescriptionReadonlyField label="Plan" value={insurancePlan} />
              <PrescriptionReadonlyField label="Dirección" value={patientAddress} />
              <PrescriptionReadonlyField label="Teléfono" value={patientPhone} />
            </div>
            {isPamiCoverage(effectivePatientInsurance) ? (
              <p className="text-xs font-medium text-teal-800">Cobertura PAMI detectada</p>
            ) : null}
          </PrescriptionFormSection>

          <PrescriptionFormSection title="Receta — cobertura">
            {coverageInfoMessages.length > 0 ? (
              <ul className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                {coverageInfoMessages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <PrescriptionReadonlyField label="Fecha" value={todayLabel} />
              <Select
                label="Tipo de receta"
                required
                value={prescriptionType}
                onChange={(e) => setPrescriptionType(e.target.value as typeof prescriptionType)}
                options={[
                  { value: "ambulatoria", label: "Ambulatoria" },
                  { value: "cronica", label: "Crónica / prolongada" },
                  { value: "duplicado", label: "Duplicado (psicotrópicos)" },
                ]}
              />
              <Select
                label="Cobertura"
                value={effectivePatientInsurance}
                onChange={(e) => setPatientInsurance(e.target.value)}
                options={coverageOptions.map((c) => ({ value: c, label: c }))}
                disabled={insuranceLocked}
              />
              <Input
                label={affiliateLabel}
                value={insuranceNumber}
                onChange={(e) => setInsuranceNumber(e.target.value)}
                placeholder={authoritativeCoverageKind === "PAMI" ? "N° beneficio" : "N° afiliado"}
              />
              {planOptions.length > 0 ? (
                <Select
                  label="Plan"
                  value={insurancePlan}
                  onChange={(e) => setInsurancePlan(e.target.value)}
                  options={planOptions.map((p) => ({ value: p, label: p }))}
                />
              ) : (
                <Input
                  label="Plan"
                  value={insurancePlan}
                  onChange={(e) => setInsurancePlan(e.target.value)}
                />
              )}
              <Input
                label="Vigencia (días)"
                type="number"
                min={1}
                max={365}
                value={validityDays}
                onChange={(e) => setValidityDays(Number(e.target.value) || 30)}
              />
            </div>
            {insuranceLocked ? (
              <p className="text-xs text-slate-600">
                La cobertura se toma del legajo del paciente y no puede modificarse en la receta.
              </p>
            ) : null}
          </PrescriptionFormSection>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <PrescriptionClinicalAssistPanel
            patient={patient}
            allergiesText={patientAllergies}
            diagnosisText={diagnosisText}
            evolutionIndications={notesDefault}
            notes={notes}
            onNotesChange={setNotes}
            medications={medications}
            onAddMedications={(meds) =>
              setMedications((prev) =>
                meds.reduce(
                  (acc, med) =>
                    acc.some(
                      (m) =>
                        m.generic_name.trim().toLowerCase() ===
                        med.generic_name.trim().toLowerCase()
                    )
                      ? acc
                      : [...acc, med],
                  prev
                )
              )
            }
            hceTreatments={hceTreatments}
          />

          <PrescriptionFormSection title="Receta">
            <PrescriptionReadonlyField label="Fecha" value={todayLabel} />
            <PrescriptionTemplatePicker
              key={professionalId}
              professionalId={professionalId}
              onApply={applyTemplate}
            />
            <PrescriptionMedicationsSection
              medications={medications}
              setMedications={setMedications}
              updateMed={updateMed}
              medicationSearch={effectiveMedicationSearch}
              diagnosisText={diagnosisText}
              cie10={cie10}
              onPathologySelect={handlePathologySelect}
            />
          </PrescriptionFormSection>

          <PrescriptionFormSection title="Diagnóstico">
            <PrescriptionDiagnosisFields
              diagnosisText={diagnosisText}
              cie10={cie10}
              onDiagnosisTextChange={setDiagnosisText}
              onCie10Change={setCie10}
            />
          </PrescriptionFormSection>

          <PrescriptionFormSection title="Indicaciones">
            <Textarea
              label="Indicaciones"
              rows={4}
              placeholder="Indicaciones para el paciente o farmacia"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </PrescriptionFormSection>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800">
            <p className="font-semibold text-slate-900">Resumen</p>
            <ul className="mt-2 space-y-1">
              <li>
                <span className="text-slate-500">Paciente:</span>{" "}
                {patientDisplay ?? patientId}
              </li>
              <li>
                <span className="text-slate-500">Cobertura:</span>{" "}
                {effectivePatientInsurance || "Particular"} (
                {authoritativeCoverageKind})
              </li>
              {insuranceNumber ? (
                <li>
                  <span className="text-slate-500">{affiliateLabel}:</span> {insuranceNumber}
                </li>
              ) : null}
              <li>
                <span className="text-slate-500">Profesional:</span>{" "}
                {selectedProfessional
                  ? getProfessionalDisplayName(selectedProfessional)
                  : "—"}
              </li>
              <li>
                <span className="text-slate-500">Diagnóstico:</span> {draftPreview.diagnosis_text} (
                {draftPreview.diagnosis_cie10})
              </li>
              <li>
                <span className="text-slate-500">Medicamentos:</span>{" "}
                {medications.filter((m) => m.generic_name.trim()).length}
              </li>
              {notes.trim() ? (
                <li>
                  <span className="text-slate-500">Indicaciones:</span> {notes}
                </li>
              ) : null}
            </ul>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              {medications
                .filter((m) => m.generic_name.trim())
                .map((m, i) => (
                  <li key={`${m.generic_name}-${i}`}>
                    <span className="font-medium">{m.generic_name}</span>
                    {m.presentation ? ` — ${m.presentation}` : ""}
                    <span className="block text-slate-600">{m.posology}</span>
                  </li>
                ))}
            </ol>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-950">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 rounded border-amber-400 text-amber-700 focus:ring-amber-500"
              checked={disclaimerAccepted}
              onChange={(e) => setDisclaimerAccepted(e.target.checked)}
            />
            <span>
              Entiendo que esta es una <strong>receta local / borrador</strong> y{" "}
              <strong>no constituye homologación REFEPS</strong>.
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-teal-200 bg-teal-50/80 p-3 text-sm text-teal-950">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 rounded border-teal-400 text-teal-700 focus:ring-teal-500"
              checked={confirmIssue}
              onChange={(e) => setConfirmIssue(e.target.checked)}
            />
            <span>Confirmo que revisé paciente, cobertura y medicamentos antes de emitir.</span>
          </label>

          <p className="text-xs text-slate-500">Atajo: Ctrl+Enter para emitir</p>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-900">Guardar como plantilla</p>
            <p className="mt-1 text-xs text-slate-600">
              Reutilizá esta combinación de medicamentos en futuras recetas.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Input
                label="Nombre de plantilla"
                value={saveTemplateName}
                onChange={(e) => setSaveTemplateName(e.target.value)}
                placeholder="Ej. HTA ambulatoria"
                className="min-w-[200px] flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-end"
                loading={templateSaving}
                onClick={() => void saveAsTemplate()}
              >
                Guardar plantilla
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-4">
        <div>
          {step > 1 ? (
            <Button type="button" variant="outline" onClick={goBack} disabled={loading}>
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {step < 3 ? (
            <Button type="button" onClick={goNext}>
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                loading={loading}
                disabled={!disclaimerAccepted}
                onClick={() => void handleSubmit(false)}
              >
                Guardar borrador
              </Button>
              <Button
                type="button"
                loading={loading}
                disabled={!disclaimerAccepted || !confirmIssue}
                onClick={() => void handleSubmit(true)}
              >
                Emitir receta
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
