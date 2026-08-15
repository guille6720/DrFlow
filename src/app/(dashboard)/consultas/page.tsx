import { endOfDay, startOfDay } from "date-fns";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { getSession } from "@/core/auth/session.server";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { PATIENT_DETAIL_COLUMNS } from "@/core/supabase/select-columns";
import { createClient } from "@/core/supabase/server";

import { DoctorConsultaSession } from "@/features/historias/components/consultas/doctor-consulta-session";
import {
  type DoctorConsultaRow,
  DoctorConsultasView,
} from "@/features/historias/components/consultas/doctor-consultas-view";
import { loadPatientWorkspacePageData } from "@/features/pacientes/server/load-patient-workspace-page";

import { Button } from "@/components/ui/button";
import { resolveSessionProfessionalId } from "@/lib/server/resolve-default-professional";
import type { Patient } from "@/types/database";

type PageProps = {
  searchParams?: Promise<{
    appointment?: string;
    patient?: string;
    professional?: string;
    action?: string;
    sheet?: string;
    focus?: string;
  }>;
};

export default async function ConsultasPage({ searchParams }: PageProps) {
  const { profile, clinics, clinicId, role, isSuperadmin, clinic } = await getDashboardPageContext();
  const session = await getSession();
  const params = (await searchParams) ?? {};

  if (!clinicId || !session) {
    redirect("/login");
  }

  if (!hasPermission(role, "editClinicalRecords", isSuperadmin)) {
    redirect("/dashboard");
  }

  const canIssue = hasPermission(role, "issuePrescriptions", isSuperadmin);
  const supabase = await createClient();
  const sessionProfessionalId = await resolveSessionProfessionalId(
    supabase,
    clinicId,
    session.id
  );
  const dayStart = startOfDay(new Date()).toISOString();
  const dayEnd = endOfDay(new Date()).toISOString();

  // Sesión de evolución (turno o paciente desde HC → Consultas).
  const sessionPatientId = params.appointment
    ? null
    : params.patient && params.action === "nueva"
      ? params.patient
      : null;

  if (params.appointment || sessionPatientId) {
    let appointment: {
      id: string;
      patient_id: string;
      professional_id: string;
    } | null = null;

    if (params.appointment) {
      const { data } = await supabase
        .from("appointments")
        .select("id, patient_id, professional_id, status, waiting_room_status")
        .eq("id", params.appointment)
        .eq("clinic_id", clinicId)
        .maybeSingle();
      appointment = data;
      if (!appointment) {
        redirect("/consultas");
      }
      if (
        role === "doctor" &&
        sessionProfessionalId &&
        appointment.professional_id !== sessionProfessionalId
      ) {
        redirect("/consultas");
      }
    }

    const patientId = appointment?.patient_id ?? sessionPatientId!;
    const { data: patient } = await supabase
      .from("patients")
      .select(PATIENT_DETAIL_COLUMNS)
      .eq("id", patientId)
      .eq("clinic_id", clinicId)
      .single();

    if (!patient) {
      redirect("/consultas");
    }

    const patientRow = patient as Patient;
    const workspace = await loadPatientWorkspacePageData(
      supabase,
      clinicId,
      patientRow,
      "soap"
    );

    const patientName = `${patientRow.last_name}, ${patientRow.first_name}`;

    return (
      <>
        <Header
          title={patientName}
          subtitle="CONSULTA EN CURSO"
          clinics={clinics}
          activeClinicId={clinicId}
          role={role}
          userName={profile?.full_name}
        />
        <div className="space-y-4 p-3 sm:p-4">
          <Suspense fallback={<p className="text-sm text-slate-500">Cargando consulta…</p>}>
            <DoctorConsultaSession
              appointmentId={appointment?.id ?? null}
              professionalId={
                params.professional ||
                appointment?.professional_id ||
                sessionProfessionalId ||
                workspace.defaultProfessionalId ||
                ""
              }
              patientRecord={patientRow}
              workspace={workspace}
              canIssue={canIssue}
              canEditClinical
              clinic={{
                name: clinic?.name ?? "Consultorio",
                address: clinic?.address ?? null,
                phone: clinic?.phone ?? null,
              }}
            />
          </Suspense>
        </div>
      </>
    );
  }

  let query = supabase
    .from("appointments")
    .select(
      "id, start_at, patient_id, professional_id, waiting_room_status, patients(first_name, last_name, document_number), professionals(display_name, profiles(full_name))"
    )
    .eq("clinic_id", clinicId)
    .gte("start_at", dayStart)
    .lte("start_at", dayEnd)
    .neq("status", "cancelled")
    .neq("status", "attended")
    .in("waiting_room_status", ["confirmed", "in_consultation"])
    .order("start_at")
    .limit(100);

  if (role === "doctor" && sessionProfessionalId) {
    query = query.eq("professional_id", sessionProfessionalId);
  }

  const { data: appointments } = await query;

  const rows: DoctorConsultaRow[] = (appointments ?? []).map((a) => {
    const patient = Array.isArray(a.patients) ? a.patients[0] ?? null : a.patients;
    const pro = Array.isArray(a.professionals) ? a.professionals[0] : a.professionals;
    const profProfile = pro?.profiles;
    const profileRow = Array.isArray(profProfile) ? profProfile[0] : profProfile;
    return {
      id: a.id,
      start_at: a.start_at,
      patient_id: a.patient_id,
      professional_id: a.professional_id,
      waiting_room_status: a.waiting_room_status,
      patients: patient,
      professionals: pro
        ? { display_name: pro.display_name, profiles: profileRow ?? null }
        : null,
    };
  });

  return (
    <>
      <Header
        title="Consultas"
        subtitle="Evoluciones del día · confirmados y en atención"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />
      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          <Link href="/sala-espera">
            <Button type="button" variant="outline" size="sm">
              Sala de espera
            </Button>
          </Link>
          <Link href="/turnos/agenda">
            <Button type="button" variant="outline" size="sm">
              Agenda
            </Button>
          </Link>
        </div>
        <DoctorConsultasView rows={rows} />
      </div>
    </>
  );
}
