"use client";

import { Pill, ScrollText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { NuevaConsultaFormState } from "@/features/historias/hooks/use-nueva-consulta-form";
import { ConsultationPhysicianAssist } from "@/features/ia/components/clinical-workflow/consultation-physician-assist";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getProfessionalDisplayName } from "@/lib/utils/professional";
import type { Patient } from "@/types/database";

type FormProfessional = {
  id: string;
  display_name?: string | null;
  license_number?: string | null;
  profiles?: { full_name?: string } | null;
};

type Props = {
  form: NuevaConsultaFormState;
  patients: Patient[];
  professionals: FormProfessional[];
  templates: Array<{ id: string; name: string }>;
  canIssuePrescriptions: boolean;
  /** Flujo lineal consulta → receta → orden → turno → fin (sin links externos). */
  journeyMode?: boolean;
};

export function NuevaConsultaFormBody({
  form,
  patients,
  professionals,
  templates,
  canIssuePrescriptions,
  journeyMode = false,
}: Props) {
  const {
    fromAppointment,
    appointmentId,
    defaultPatient,
    defaultProfessional,
    patientId,
    setPatientId,
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
    pharmacologyHref,
    flushEvolutionDraft,
    recetaHref,
    handleSubmit,
    applyTemplate,
  } = form;

  const [voiceDraftPending, setVoiceDraftPending] = useState(false);

  return (
    <>
      {templates.length > 0 && (
        <Select
          label="Plantilla por especialidad"
          options={templates.map((t) => ({ value: t.id, label: t.name }))}
          placeholder="Aplicar plantilla..."
          onChange={(e) => applyTemplate(e.target.value)}
        />
      )}

      <Card title={fromAppointment ? "Historia clínica" : "Registro de consulta"}>
        <form id="clinical-form" onSubmit={handleSubmit} className="grid gap-4">
          {appointmentId ? <input type="hidden" name="appointment_id" value={appointmentId} /> : null}

          {fromAppointment ? (
            <>
              <input type="hidden" name="patient_id" value={defaultPatient} />
              <input type="hidden" name="professional_id" value={defaultProfessional} />
            </>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                name="patient_id"
                label="Paciente"
                required
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                options={patients.map((p) => ({
                  value: p.id,
                  label: `${p.last_name}, ${p.first_name}`,
                }))}
                placeholder="Seleccionar"
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

          <Textarea
            name="evolution"
            label="Evolución"
            required
            rows={10}
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

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={loading}>
              {journeyMode && fromAppointment ? "Guardar y continuar" : "Guardar consulta"}
            </Button>
            {!journeyMode && canIssuePrescriptions && consultationContext ? (
              <Link
                href={recetaHref()}
                onClick={flushEvolutionDraft}
                className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-800 hover:bg-teal-100"
              >
                <ScrollText className="h-4 w-4" />
                Generar receta
              </Link>
            ) : null}
            {fromAppointment ? (
              <Link
                href="/agenda?view=day"
                className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Volver a agenda
              </Link>
            ) : null}
          </div>
        </form>
      </Card>
    </>
  );
}
