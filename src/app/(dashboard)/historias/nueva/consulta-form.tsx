"use client";

import Link from "next/link";
import { Header } from "@/components/layout/header";
import { ConsultationFlowBar } from "@/components/historias/consultation-flow-bar";
import { PamiPatientBanner } from "@/components/pacientes/pami-patient-banner";
import { NuevaConsultaFormBody } from "@/components/historias/nueva-consulta-form-body";
import { useNuevaConsultaForm } from "@/lib/hooks/use-nueva-consulta-form";
import type { Clinic, Patient, Professional, UserRole } from "@/types/database";
import { ArrowLeft } from "lucide-react";

interface Props {
  clinics: { clinic_id: string; clinic?: Clinic }[];
  clinicId: string | null;
  role: UserRole | null;
  userName?: string;
  patients: Patient[];
  professionals: Professional[];
  templates: Array<{
    id: string;
    name: string;
    chief_complaint_template: string | null;
    diagnosis_template: string | null;
    evolution_template: string | null;
    indications_template: string | null;
  }>;
  canIssuePrescriptions?: boolean;
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
}: Props) {
  const form = useNuevaConsultaForm({ patients, professionals, templates });

  return (
    <>
      <Header
        title={form.fromAppointment ? "Consulta en curso" : "Nueva consulta"}
        subtitle={
          form.fromAppointment ? "Flujo DrFlow: agenda → consulta → receta" : undefined
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
