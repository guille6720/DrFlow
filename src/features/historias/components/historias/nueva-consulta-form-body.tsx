"use client";

import { Pill, ScrollText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { SignatureImage } from "@/core/components/ui/signature-image";
import type { ConsultPatientPickerRow } from "@/core/supabase/query-types";

import { cn } from "@/shared/utils/cn";

import { ClinicalTemplateVariablesPanel } from "@/features/historias/components/historias/clinical-template-variables-panel";
import type { NuevaConsultaFormState } from "@/features/historias/hooks/use-nueva-consulta-form";
import { ConsultationPhysicianAssist } from "@/features/ia/components/clinical-workflow/consultation-physician-assist";
import { PatientSearchCombobox } from "@/features/pacientes/components/pacientes/patient-search-combobox";

import { Button, ButtonLink, buttonSurfaceClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getProfessionalDisplayName } from "@/lib/utils/professional";

type FormProfessional = {
  id: string;
  display_name?: string | null;
  license_number?: string | null;
  profiles?: { full_name?: string } | { full_name?: string }[] | null;
};

type Props = {
  form: NuevaConsultaFormState;
  patients: ConsultPatientPickerRow[];
  professionals: FormProfessional[];
  templates: Array<{ id: string; name: string }>;
  canIssuePrescriptions: boolean;
  /** Flujo lineal consulta → receta → orden → turno → fin (sin links externos). */
  journeyMode?: boolean;
  /** Usa el alto disponible del overlay (textarea expandible). */
  fillViewport?: boolean;
};

export function NuevaConsultaFormBody({
  form,
  patients,
  professionals,
  templates,
  canIssuePrescriptions,
  journeyMode = false,
  fillViewport = false,
}: Props) {
  const {
    fromAppointment,
    appointmentId,
    defaultPatient,
    defaultProfessional,
    patientId,
    handlePatientChange,
    selectedPatient,
    consultationContext,
    error,
    loading,
    professionalId,
    setProfessionalId,
    evolution,
    setEvolution,
    professionalSignature,
    setProfessionalSignature,
    professionalSignatureImageUrl,
    pharmacologyHref,
    flushEvolutionDraft,
    recetaHref,
    handleSubmit,
    applyTemplate,
    templateVariableKeys,
    templateVariableValues,
    updateTemplateVariable,
  } = form;

  const [voiceDraftPending, setVoiceDraftPending] = useState(false);

  return (
    <div className={cn("space-y-4", fillViewport && "flex min-h-0 flex-1 flex-col gap-4 overflow-hidden")}>
      {templates.length > 0 && (
        <div className="space-y-3">
          <Select
            label="Plantilla por especialidad"
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
      )}

      <Card
        title={fromAppointment ? "Historia clínica" : "Registro de consulta"}
        className={fillViewport ? "flex min-h-0 flex-1 flex-col overflow-hidden" : undefined}
        bodyClassName={fillViewport ? "flex min-h-0 flex-1 flex-col overflow-hidden" : undefined}
      >
        <form
          id="clinical-form"
          onSubmit={handleSubmit}
          className={cn("grid gap-4", fillViewport && "flex min-h-0 flex-1 flex-col overflow-hidden")}
        >
          {appointmentId ? <input type="hidden" name="appointment_id" value={appointmentId} /> : null}

          {fromAppointment ? (
            <>
              <input type="hidden" name="patient_id" value={defaultPatient} />
              <input type="hidden" name="professional_id" value={defaultProfessional} />
            </>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <PatientSearchCombobox
                patients={patients.map((p) => ({
                  id: p.id,
                  first_name: p.first_name,
                  last_name: p.last_name,
                  document_number: p.document_number ?? "",
                }))}
                name="patient_id"
                label="Paciente"
                required
                searchMode="remote"
                defaultPatientId={patientId || undefined}
                onPatientChange={handlePatientChange}
              />
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
            </div>
          )}

          <div
            className={cn(
              fillViewport && "flex min-h-0 flex-1 flex-col overflow-y-auto gap-4"
            )}
          >
            <Textarea
              name="evolution"
              label="Evolución"
              required
              rows={fillViewport ? 12 : 10}
              voiceInput
              value={evolution}
              onChange={(e) => {
                setEvolution(e.target.value);
                if (!e.target.value.trim()) setVoiceDraftPending(false);
              }}
              onVoiceAppend={() => setVoiceDraftPending(true)}
            />

            {selectedPatient && consultationContext ? (
              <ConsultationPhysicianAssist
                patientId={selectedPatient.id}
                context={{
                  patientName: `${selectedPatient.last_name}, ${selectedPatient.first_name}`,
                  allergies: selectedPatient.allergies,
                  regularMedication: selectedPatient.regular_medication,
                  medicalHistory: selectedPatient.medical_history,
                }}
                evolutionText={evolution}
                onApplyToEvolution={(text) => {
                  setEvolution(text);
                  setVoiceDraftPending(false);
                }}
                pharmacologyHref={pharmacologyHref()}
                voiceDraftPending={voiceDraftPending}
              />
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <Link
              href={pharmacologyHref("symptoms")}
              onClick={flushEvolutionDraft}
              className="drflow-clinical-assist-link inline-flex items-center gap-1.5 hover:underline"
            >
              <Pill className="h-4 w-4" />
              Buscar por síntomas
            </Link>
            <Link
              href={pharmacologyHref()}
              onClick={flushEvolutionDraft}
              className="drflow-clinical-assist-link inline-flex items-center gap-1.5 hover:underline"
            >
              <Pill className="h-4 w-4" />
              Guía farmacológica
            </Link>
          </div>

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

          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={loading}>
              {loading
                ? "Guardando..."
                : journeyMode && fromAppointment
                  ? "Guardar y continuar"
                  : "Guardar consulta"}
            </Button>
            {!journeyMode && canIssuePrescriptions && consultationContext ? (
              <Link
                href={recetaHref()}
                onClick={flushEvolutionDraft}
                className={buttonSurfaceClassName("secondary", "md")}
              >
                <ScrollText className="h-4 w-4" />
                Generar receta
              </Link>
            ) : null}
            {fromAppointment ? (
              <ButtonLink href="/turnos/agenda?view=day" variant="outline">
                Volver a agenda
              </ButtonLink>
            ) : null}
          </div>
        </form>
      </Card>
    </div>
  );
}
