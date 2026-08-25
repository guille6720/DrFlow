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
import type { Patient } from "@/types/database";

type TurnoWizardPatient = Pick<
  Patient,
  "id" | "first_name" | "last_name" | "document_number" | "insurance_provider" | "insurance_plan"
>;

function toTurnoWizardPatient(row: {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string | null;
  insurance_provider: string | null;
  insurance_plan: string | null;
}): TurnoWizardPatient {
  return {
    ...row,
    document_number: row.document_number ?? "",
  };
}

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

  let professionals: Awaited<ReturnType<typeof getCachedClinicProfessionalsAgenda>> = [];
  let locations: Awaited<ReturnType<typeof getCachedClinicLocations>> = [];
  let specialties: Awaited<ReturnType<typeof getCachedClinicSpecialties>> = [];
  let clinicSettings: Awaited<ReturnType<typeof getCachedClinicSettings>> = null;
  let sessionProfessionalId: string | undefined;
  let defaultProfessionalId: string | undefined;
  let initialPatient: TurnoWizardPatient | null = null;
  let initialWizardSlots: Awaited<ReturnType<typeof loadTurnosWizardSlots>> | null = null;

  try {
    if (clinicId) {
      [professionals, locations, specialties, clinicSettings] = await Promise.all([
        getCachedClinicProfessionalsAgenda(clinicId),
        getCachedClinicLocations(clinicId),
        getCachedClinicSpecialties(clinicId),
        getCachedClinicSettings(clinicId),
      ]);
    }

    const user = await getSession();
    sessionProfessionalId =
      user && clinicId
        ? await resolveSessionProfessionalId(supabase, clinicId, user.id)
        : undefined;

    defaultProfessionalId = clinicId
      ? await resolveDefaultProfessionalId(
          supabase,
          clinicId,
          professionals,
          professionalParam ?? sessionProfessionalId
        )
      : undefined;

    if (clinicId && patientParam) {
      const patientResult = await supabase
        .from("patients")
        .select("id, first_name, last_name, document_number, insurance_provider, insurance_plan")
        .eq("clinic_id", clinicId)
        .eq("id", patientParam)
        .eq("is_active", true)
        .maybeSingle();
      initialPatient = patientResult.data ? toTurnoWizardPatient(patientResult.data) : null;
    }

    if (clinicId && defaultProfessionalId) {
      initialWizardSlots = await loadTurnosWizardSlots(
        supabase,
        clinicId,
        defaultProfessionalId
      );
    }
  } catch (err) {
    console.error("[turnos/nuevo] page data load failed:", err);
  }

  const canOverbook =
    hasPermission(role, "manageClinic", isSuperadmin, permissionOverrides) ||
    hasPermission(role, "manageAppointments", isSuperadmin, permissionOverrides);

  return (
    <>
      <Header
        title="Nuevo turno"
        clinics={clinics}
        role={role}
        userName={profile?.full_name}
        isSuperadmin={isSuperadmin}
      />
      <div className="flex h-full min-h-0 flex-col p-3 lg:p-3">
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
