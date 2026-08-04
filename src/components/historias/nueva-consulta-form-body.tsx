"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ConsultationAssistantPanel } from "@/components/historias/consultation-assistant-panel";
import { getProfessionalDisplayName } from "@/lib/utils/professional";
import type { Patient, Professional } from "@/types/database";
import type { NuevaConsultaFormState } from "@/lib/hooks/use-nueva-consulta-form";
import { Pill, ScrollText } from "lucide-react";

type Props = {
  form: NuevaConsultaFormState;
  patients: Patient[];
  professionals: Professional[];
  templates: Array<{ id: string; name: string }>;
  canIssuePrescriptions: boolean;
};

export function NuevaConsultaFormBody({
  form,
  patients,
  professionals,
  templates,
  canIssuePrescriptions,
}: Props) {
  const {
    fromAppointment,
    appointmentId,
    defaultPatient,
    defaultProfessional,
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
                defaultValue={defaultPatient}
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

          {selectedPatient && consultationContext ? (
            <ConsultationAssistantPanel
              patientId={selectedPatient.id}
              allergies={selectedPatient.allergies}
              regularMedication={selectedPatient.regular_medication}
              evolutionText={evolution}
              pharmacologyHref={pharmacologyHref()}
            />
          ) : null}

          <Textarea
            name="evolution"
            label="Evolución"
            required
            rows={10}
            voiceInput
            value={evolution}
            onChange={(e) => setEvolution(e.target.value)}
          />

          <div className="flex flex-wrap gap-3 text-sm">
            <Link
              href={pharmacologyHref("symptoms")}
              onClick={flushEvolutionDraft}
              className="inline-flex items-center gap-1.5 text-violet-700 hover:underline"
            >
              <Pill className="h-4 w-4" />
              Buscar por síntomas
            </Link>
            <Link
              href={pharmacologyHref()}
              onClick={flushEvolutionDraft}
              className="inline-flex items-center gap-1.5 text-blue-700 hover:underline"
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
              Guardar consulta
            </Button>
            {canIssuePrescriptions && consultationContext ? (
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
