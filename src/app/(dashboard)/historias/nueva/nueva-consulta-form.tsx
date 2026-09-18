"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Header } from "@/core/components/layout/header";
import type { ConsultPatientPickerRow, ProfessionalListRow } from "@/core/supabase/query-types";

import { ConsultationFlowBar } from "@/features/historias/components/historias/consultation-flow-bar";
import { NuevaConsultaFormBody } from "@/features/historias/components/historias/nueva-consulta-form-body";
import { useNuevaConsultaForm } from "@/features/historias/hooks/use-nueva-consulta-form";
import { PamiPatientBanner } from "@/features/pacientes/components/pacientes/pami-patient-banner";

import type { Clinic, UserRole } from "@/types/database";

interface Props {
  clinics: { clinic_id: string; clinic?: Clinic }[];
  clinicId: string | null;
  role: UserRole | null;
  userName?: string;
  patients: ConsultPatientPickerRow[];
  professionals: ProfessionalListRow[];
  templates: Array<{
    id: string;
    name: string;
    chief_complaint_template: string | null;
    diagnosis_template: string | null;
    evolution_template: string | null;
    indications_template: string | null;
  }>;
  canIssuePrescriptions?: boolean;
  defaultProfessionalId?: string;
}

export default function NuevaConsultaForm({
  clinics,
  clinicId,
  role,
  userName,
  patients,
  professionals,
  templates,
  canIssuePrescriptions = false,
  defaultProfessionalId,
}: Props) {
  const form = useNuevaConsultaForm({
    patients,
    professionals,
    templates,
    fallbackProfessionalId: defaultProfessionalId,
  });

  return (
    <>
      <Header
        title={form.fromAppointment ? "Consulta en curso" : "Nueva consulta"}
        subtitle={
          form.fromAppointment ? "Flujo NexClinic: agenda → consulta → receta" : undefined
        }
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={userName}
      />
      <div className="space-y-4 p-4 sm:p-6">
        {!form.fromAppointment && (
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={form.backHref}
              className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
            >
              <ArrowLeft className="h-4 w-4" /> Volver
            </Link>
          </div>
        )}

        {form.fromAppointment && (
          <ConsultationFlowBar
            appointmentId={form.appointmentId}
            patient={form.selectedPatient}
            showSteps={false}
            recetaHref={
              canIssuePrescriptions && form.consultationContext
                ? form.recetaHref()
                : undefined
            }
            onRecetaClick={form.flushEvolutionDraft}
          />
        )}

        {form.selectedPatient ? <PamiPatientBanner patient={form.selectedPatient} /> : null}

        <NuevaConsultaFormBody
          form={form}
          patients={patients}
          professionals={professionals}
          templates={templates}
          canIssuePrescriptions={canIssuePrescriptions}
        />
      </div>
    </>
  );
}
