"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Header } from "@/core/components/layout/header";

import { ConsultationFlowBar } from "@/features/historias/components/historias/consultation-flow-bar";
import { EditConsultaFormBody } from "@/features/historias/components/historias/edit-consulta-form-body";
import { useEditConsultaForm } from "@/features/historias/hooks/use-edit-consulta-form";
import { PamiPatientBanner } from "@/features/pacientes/components/pacientes/pami-patient-banner";

import { Select } from "@/components/ui/select";
import type { Clinic, Patient, UserRole } from "@/types/database";

interface RecordData {
  id: string;
  patient_id: string;
  professional_id: string;
  appointment_id: string | null;
  chief_complaint: string | null;
  diagnosis: string | null;
  evolution: string | null;
  indications: string | null;
  professional_signature: string | null;
}

interface Props {
  record: RecordData;
  patient?: Patient | null;
  clinics: { clinic_id: string; clinic?: Clinic }[];
  clinicId: string | null;
  role: UserRole | null;
  userName?: string;
  backHref?: string;
  templates?: Array<{
    id: string;
    name: string;
    chief_complaint_template: string | null;
    diagnosis_template: string | null;
    evolution_template: string | null;
    indications_template: string | null;
  }>;
  canIssuePrescriptions?: boolean;
}

export function EditConsultaForm({
  record,
  patient,
  clinics,
  clinicId,
  role,
  userName,
  backHref = `/historias/${record.id}`,
  templates = [],
  canIssuePrescriptions = false,
}: Props) {
  const form = useEditConsultaForm({ record, templates });

  return (
    <>
      <Header
        title="Editar consulta"
        subtitle={record.appointment_id ? "Flujo DrFlow: agenda → consulta → receta" : undefined}
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={userName}
      />
      <div className="space-y-4 p-4 sm:p-6">
        {!record.appointment_id && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
        )}

        {record.appointment_id && (
          <ConsultationFlowBar
            appointmentId={record.appointment_id}
            patient={patient}
            showSteps={false}
            recetaHref={canIssuePrescriptions ? form.recetaHref() : undefined}
            onRecetaClick={form.flushEvolutionDraft}
          />
        )}

        {patient && <PamiPatientBanner patient={patient} />}

        {templates.length > 0 && (
          <Select
            label="Plantilla por especialidad"
            options={templates.map((t) => ({ value: t.id, label: t.name }))}
            placeholder="Aplicar plantilla..."
            onChange={(e) => form.applyTemplate(e.target.value)}
          />
        )}

        <EditConsultaFormBody
          record={record}
          patient={patient}
          canIssuePrescriptions={canIssuePrescriptions}
          form={form}
        />
      </div>
    </>
  );
}
