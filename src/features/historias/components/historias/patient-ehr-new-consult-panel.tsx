"use client";

import { Loader2, Upload } from "lucide-react";
import { useEffect, useRef } from "react";

import { SignatureImage } from "@/core/components/ui/signature-image";

import { cn } from "@/shared/utils/cn";

import { ClinicalTemplateVariablesPanel } from "@/features/historias/components/historias/clinical-template-variables-panel";
import { ConsultEvolutionStructuredFields } from "@/features/historias/components/historias/consult-evolution-structured-fields";
import type { NuevaConsultaFormState } from "@/features/historias/hooks/use-nueva-consulta-form";
import type { PatientWorkspaceFocus } from "@/features/pacientes/utils/patient-workspace-actions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useClinicalDocumentsPanel } from "@/lib/hooks/use-clinical-documents-panel";
import { EHR_NEW_CONSULT_FORM_ID } from "@/lib/utils/clinical-history-filename";
import { getProfessionalDisplayName } from "@/lib/utils/professional";

type FormProfessional = {
  id: string;
  display_name?: string | null;
  license_number?: string | null;
  profiles?: { full_name?: string } | null;
};

type Props = {
  patientId: string;
  form: NuevaConsultaFormState;
  professionals: FormProfessional[];
  templates: Array<{ id: string; name: string }>;
  focus?: PatientWorkspaceFocus | null;
  showArchivo?: boolean;
};

function sectionId(focus: PatientWorkspaceFocus) {
  return `ehr-consult-${focus}`;
}

export function PatientEhrNewConsultPanel({
  patientId,
  form,
  professionals,
  templates,
  focus,
  showArchivo = false,
}: Props) {
  const {
    evolution,
    setEvolution,
    chiefComplaint,
    setChiefComplaint,
    diagnoses,
    setDiagnoses,
    indications,
    setIndications,
    clinicalTreatments,
    setClinicalTreatments,
    treatmentMedications,
    setTreatmentMedications,
    vitals,
    setVitals,
    professionalId,
    setProfessionalId,
    consultationAt,
    setConsultationAt,
    professionalSignature,
    setProfessionalSignature,
    professionalSignatureImageUrl,
    error,
    loading,
    handleSubmit,
    handleFormKeyDown,
    formRef,
    applyTemplate,
    templateVariableKeys,
    templateVariableValues,
    updateTemplateVariable,
  } = form;

  const evolutionRef = useRef<HTMLTextAreaElement>(null);
  const diagnosisAnchorRef = useRef<HTMLDivElement>(null);
  const diagnosisSearchRef = useRef<HTMLInputElement>(null);
  const treatmentSearchRef = useRef<HTMLInputElement>(null);
  const medicationSearchRef = useRef<HTMLInputElement>(null);
  const vitalsRef = useRef<HTMLTextAreaElement>(null);
  const {
    fileInputRef,
    uploading,
    error: uploadError,
    handleFileChange,
  } = useClinicalDocumentsPanel(patientId);

  const activeProfessional = professionals.find((p) => p.id === professionalId);

  useEffect(() => {
    const target =
      focus === "diagnostico"
        ? diagnosisSearchRef
        : focus === "tratamiento"
          ? treatmentSearchRef
          : focus === "vitales"
            ? vitalsRef
            : evolutionRef;
    target.current?.focus();
    target.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focus]);

  return (
    <div className="drflow-ehr-evolution-box mt-3 min-h-[240px] rounded-sm border p-4">
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <Input
            type="datetime-local"
            label="Fecha de la consulta"
            value={consultationAt}
            onChange={(e) => setConsultationAt(e.target.value)}
          />
        </div>
        <p className="pb-2 text-xs drflow-ehr-muted">
          {activeProfessional ? getProfessionalDisplayName(activeProfessional) : null}
        </p>
      </div>

      {templates.length > 0 ? (
        <div className="mb-3 space-y-3">
          <Select
            label="Plantilla"
            options={templates.map((t) => ({ value: t.id, label: t.name }))}
            placeholder="Aplicar plantilla..."
            onChange={(e) => applyTemplate(e.target.value)}
          />
          <ClinicalTemplateVariablesPanel
            keys={templateVariableKeys}
            values={templateVariableValues}
            onChange={updateTemplateVariable}
          />
        </div>
      ) : null}

      <form
        id={EHR_NEW_CONSULT_FORM_ID}
        ref={formRef}
        onSubmit={handleSubmit}
        onKeyDown={handleFormKeyDown}
        className="space-y-3"
      >
        <input type="hidden" name="patient_id" value={patientId} />
        <input type="hidden" name="professional_id" value={professionalId} />

        {professionals.length > 1 ? (
          <Select
            name="professional_id"
            label="Profesional"
            required
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
            options={professionals.map((p) => ({
              value: p.id,
              label: getProfessionalDisplayName(p),
            }))}
            placeholder="Seleccionar"
          />
        ) : null}

        <section id={sectionId("evolucion")} className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide drflow-ehr-label">Evolución</p>
          <Textarea
            name="chief_complaint"
            label="Motivo de consulta"
            rows={2}
            voiceInput
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            placeholder="Motivo de la consulta…"
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
            className={cn(focus === "evolucion" && "ring-2 ring-teal-400/60")}
          />
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
          diagnosisHighlighted={focus === "diagnostico"}
          treatmentHighlighted={focus === "tratamiento"}
          diagnosisSearchRef={diagnosisSearchRef}
          treatmentSearchRef={treatmentSearchRef}
          medicationSearchRef={medicationSearchRef}
          diagnosisAnchorRef={diagnosisAnchorRef}
        />

        <div id={sectionId("vitales")}>
          <Textarea
            ref={vitalsRef}
            label="Signos vitales"
            rows={2}
            voiceInput
            value={vitals}
            onChange={(e) => setVitals(e.target.value)}
            placeholder="TA, FC, FR, T°, Sat O₂, peso..."
            className={cn(focus === "vitales" && "ring-2 ring-teal-400/60")}
          />
        </div>

        {showArchivo ? (
          <div className="rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--ehr-panel)_96%,var(--ehr-label)_4%)] p-3">
            <p className="mb-2 text-xs font-semibold drflow-ehr-muted">Archivo adjunto</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Subir PDF o imagen
            </Button>
            {uploadError ? <p className="mt-2 text-xs text-red-600">{uploadError}</p> : null}
          </div>
        ) : null}

        <Input
          name="professional_signature"
          label="Firma del profesional"
          value={professionalSignature}
          onChange={(e) => setProfessionalSignature(e.target.value)}
          placeholder="Dr/a. Nombre Apellido — Mat. XXXXX"
        />
        {professionalSignatureImageUrl ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3">
            <SignatureImage
              src={professionalSignatureImageUrl}
              alt="Firma del profesional"
              className="max-h-16 max-w-[200px] object-contain"
            />
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-xs drflow-ehr-muted">Enter o Ctrl+Enter guarda la evolución.</p>
          <Button type="submit" size="sm" loading={loading}>
            Guardar evolución
          </Button>
        </div>
      </form>
    </div>
  );
}
