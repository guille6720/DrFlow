"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ConsultationPhysicianAssist } from "@/features/ia/components/clinical-workflow/consultation-physician-assist";
import type { EditConsultaFormState, RecordData } from "@/features/historias/hooks/use-edit-consulta-form";
import type { Patient } from "@/types/database";
import { Pill, ScrollText } from "lucide-react";

interface Props {
  record: RecordData;
  patient?: Patient | null;
  canIssuePrescriptions: boolean;
  form: EditConsultaFormState;
}

export function EditConsultaFormBody({
  record,
  patient,
  canIssuePrescriptions,
  form,
}: Props) {
  const [voiceDraftPending, setVoiceDraftPending] = useState(false);

  return (
    <Card title="Actualizar consulta">
      <form onSubmit={form.handleSubmit} className="grid gap-4">
        <input type="hidden" name="patient_id" value={record.patient_id} />
        <input type="hidden" name="professional_id" value={record.professional_id} />
        {record.appointment_id && (
          <input type="hidden" name="appointment_id" value={record.appointment_id} />
        )}

        <Textarea
          name="evolution"
          label="Evolución"
          required
          rows={12}
          voiceInput
          value={form.evolution}
          onChange={(e) => {
            form.setEvolution(e.target.value);
            if (!e.target.value.trim()) setVoiceDraftPending(false);
          }}
          onVoiceAppend={() => setVoiceDraftPending(true)}
        />

        {patient ? (
          <ConsultationPhysicianAssist
            patientId={record.patient_id}
            context={{
              patientName: `${patient.last_name}, ${patient.first_name}`,
              allergies: patient.allergies,
              regularMedication: patient.regular_medication,
              medicalHistory: patient.medical_history,
              diagnosis: record.diagnosis,
            }}
            evolutionText={form.evolution}
            onApplyToEvolution={(text) => {
              form.setEvolution(text);
              setVoiceDraftPending(false);
            }}
            pharmacologyHref={form.pharmacologyHref()}
            voiceDraftPending={voiceDraftPending}
          />
        ) : null}

        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href={form.pharmacologyHref("symptoms")}
            onClick={form.flushEvolutionDraft}
            className="drflow-clinical-assist-link inline-flex items-center gap-1.5 hover:underline"
          >
            <Pill className="h-4 w-4" />
            Buscar por síntomas
          </Link>
          <Link
            href={form.pharmacologyHref()}
            onClick={form.flushEvolutionDraft}
            className="drflow-clinical-assist-link inline-flex items-center gap-1.5 hover:underline"
          >
            <Pill className="h-4 w-4" />
            Guía farmacológica
          </Link>
        </div>

        <Input
          name="professional_signature"
          label="Firma del profesional"
          value={form.professionalSignature}
          onChange={(e) => form.setProfessionalSignature(e.target.value)}
          placeholder="Dr/a. Nombre Apellido — Mat. XXXXX"
        />

        {form.error && <p className="text-sm text-red-600">{form.error}</p>}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={form.loading}>
            Guardar cambios
          </Button>
          {canIssuePrescriptions && (
            <Link
              href={form.recetaHref()}
              onClick={form.flushEvolutionDraft}
              className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-800 hover:bg-teal-100"
            >
              <ScrollText className="h-4 w-4" />
              Generar receta
            </Link>
          )}
          {record.appointment_id && (
            <Link
              href="/agenda?view=day"
              className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Volver a agenda
            </Link>
          )}
        </div>
      </form>
    </Card>
  );
}
