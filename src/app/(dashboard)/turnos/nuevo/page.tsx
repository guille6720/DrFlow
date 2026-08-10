import Link from "next/link";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { getSession } from "@/core/auth/session.server";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { TurnosNuevoWizard } from "@/features/turnos/components/turnos-nuevo-wizard";
import { loadTurnosWizardSlots } from "@/features/turnos/server/load-turnos-wizard-slots";

import {
  getCachedClinicLocations,
  getCachedClinicProfessionalsAgenda,
  getCachedClinicSettings,
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

  const [professionals, locations, specialties, clinicSettings] = clinicId
    ? await Promise.all([
        getCachedClinicProfessionalsAgenda(clinicId),
        getCachedClinicLocations(clinicId),
        getCachedClinicSpecialties(clinicId),
        getCachedClinicSettings(clinicId),
      ])
    : [[], [], [], null];

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

  const initialWizardSlots =
    clinicId && defaultProfessionalId
      ? await loadTurnosWizardSlots(supabase, clinicId, defaultProfessionalId)
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
          patients={initialPatient ? [initialPatient] : []}
          initialPatient={initialPatient}
          professionals={professionals}
          locations={locations}
          specialties={specialties}
          defaultDuration={clinicSettings?.default_appointment_duration ?? 30}
          canOverbook={canOverbook}
          defaultProfessionalId={defaultProfessionalId}
          initialStartAt={startAtParam}
          initialWizardSlots={
            initialWizardSlots
              ? {
                  slots: initialWizardSlots.slots,
                  appointments: initialWizardSlots.appointments,
                  scheduleBlocks: initialWizardSlots.scheduleBlocks,
                }
              : undefined
          }
        />
      </div>
    </>
  );
}
