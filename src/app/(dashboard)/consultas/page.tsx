import { endOfDay, startOfDay } from "date-fns";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getSession,
  getUserClinics,
} from "@/core/auth/session.server";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import {
  DoctorConsultasView,
  type DoctorConsultaRow,
} from "@/features/historias/components/consultas/doctor-consultas-view";

import { Button } from "@/components/ui/button";
import { resolveSessionProfessionalId } from "@/lib/server/resolve-default-professional";

type PageProps = {
  searchParams?: Promise<{ appointment?: string }>;
};

export default async function ConsultasPage({ searchParams }: PageProps) {
  const profile = await getProfile();
  const session = await getSession();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  const params = (await searchParams) ?? {};

  if (!clinicId || !session) {
    redirect("/login");
  }

  if (!hasPermission(role, "editClinicalRecords", isSuperadmin)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const professionalId = await resolveSessionProfessionalId(supabase, clinicId, session.id);
  const dayStart = startOfDay(new Date()).toISOString();
  const dayEnd = endOfDay(new Date()).toISOString();

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
    .order("start_at");

  // Doctors only see their own queue; admins see all.
  if (role === "doctor" && professionalId) {
    query = query.eq("professional_id", professionalId);
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
        subtitle="Pacientes confirmados y en atención"
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
        <DoctorConsultasView
          rows={rows}
          highlightAppointmentId={params.appointment ?? null}
        />
      </div>
    </>
  );
}
