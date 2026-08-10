import Link from "next/link";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { getSession } from "@/core/auth/session.server";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { PATIENT_PICKER_INITIAL_LIMIT } from "@/core/supabase/pagination";
import { createClient } from "@/core/supabase/server";

import { TurnosNuevoWizard } from "@/features/turnos/components/turnos-nuevo-wizard";

import {
  getCachedClinicLocations,
  getCachedClinicProfessionalsAgenda,
  getCachedClinicSpecialties,
} from "@/lib/server/cached-clinic-queries";
import {
  resolveDefaultProfessionalId,
  resolveSessionProfessionalId,
} from "@/lib/server/resolve-default-professional";

export default async function TurnosNuevoPage({
  searchParams,
}: {
  searchParams: Promise<{ professional?: string; start_at?: string; patient?: string }>;
}) {
  const { professional: professionalParam, start_at: startAtParam, patient: patientParam } =
    await searchParams;
  const ctx = await getDashboardPageContext();
  const { clinicId, role, isSuperadmin, permissionOverrides, clinics, profile } = ctx;

  if (!hasPermission(role, "manageAppointments", isSuperadmin, permissionOverrides)) {
    return (
      <>
        <Header title="Nuevo turno" clinics={clinics} role={role} userName={profile?.full_name} isSuperadmin={isSuperadmin} />
        <p className="p-4 text-sm text-red-600">No tenés permiso para crear turnos.</p>
      </>
    );
  }

  const supabase = await createClient();

  const [patients, professionals, locations, specialties, clinic] = clinicId
    ? await Promise.all([
        supabase
          .from("patients")
          .select("id, first_name, last_name, document_number, insurance_provider, insurance_plan")
          .eq("clinic_id", clinicId)
          .eq("is_active", true)
          .order("last_name")
          .limit(PATIENT_PICKER_INITIAL_LIMIT),
        getCachedClinicProfessionalsAgenda(clinicId),
        getCachedClinicLocations(clinicId),
        getCachedClinicSpecialties(clinicId),
        supabase
          .from("clinics")
          .select("default_appointment_duration")
          .eq("id", clinicId)
          .single(),
      ])
    : [{ data: [] }, [], [], [], { data: null }];

  const canOverbook =
    hasPermission(role, "manageClinic", isSuperadmin, permissionOverrides) ||
    hasPermission(role, "manageAppointments", isSuperadmin, permissionOverrides);

  const user = await getSession();
  const sessionProfessionalId =
    user && clinicId ? await resolveSessionProfessionalId(supabase, clinicId, user.id) : undefined;

  const defaultProfessionalId = clinicId
    ? await resolveDefaultProfessionalId(
        supabase,
        clinicId,
        professionals,
        professionalParam ?? sessionProfessionalId
      )
    : undefined;

  const initialPatient =
    clinicId && patientParam
      ? (
          await supabase
            .from("patients")
            .select("id, first_name, last_name, document_number, insurance_provider, insurance_plan")
            .eq("clinic_id", clinicId)
            .eq("id", patientParam)
            .eq("is_active", true)
            .maybeSingle()
        ).data
      : null;

  return (
    <>
      <Header
        title="Nuevo turno"
        clinics={clinics}
        role={role}
        userName={profile?.full_name}
        isSuperadmin={isSuperadmin}
      />
      <div className="p-4 lg:p-6">
        <p className="mb-4 text-sm">
          <Link href="/turnos/agenda" className="text-[var(--primary)] hover:underline">
            ← Volver a la agenda
          </Link>
        </p>
        <TurnosNuevoWizard
          patients={patients.data ?? []}
          initialPatient={initialPatient}
          professionals={professionals}
          locations={locations}
          specialties={specialties}
          defaultDuration={clinic.data?.default_appointment_duration ?? 30}
          canOverbook={canOverbook}
          defaultProfessionalId={defaultProfessionalId}
          initialStartAt={startAtParam}
        />
      </div>
    </>
  );
}
