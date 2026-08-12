import { subDays } from "date-fns";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { Header } from "@/core/components/layout/header";
import { APPOINTMENTS_AGENDA_MAX } from "@/core/supabase/pagination";
import type { AppointmentAgendaRow, ProfessionalAgendaRow } from "@/core/supabase/query-types";
import { APPOINTMENT_AGENDA_COLUMNS } from "@/core/supabase/select-columns";
import { createClient } from "@/core/supabase/server";

import { AgendaView } from "@/features/agenda";

import {
  getCachedActiveBookingSlug,
  getCachedClinicLocations,
  getCachedClinicProfessionalsAgenda,
  getCachedClinicSpecialties,
} from "@/lib/server/cached-clinic-queries";
import { resolveDefaultProfessionalId } from "@/lib/server/resolve-default-professional";
import { getAppointmentHorizonEnd } from "@/lib/utils/appointment-booking-horizon";

export default async function TurnosAgendaPage() {
  const { profile, clinics, clinicId, clinic, role, isSuperadmin, permissionOverrides } =
    await getDashboardPageContext();
  const supabase = await createClient();

  const now = new Date();
  const rangeStart = subDays(now, 30).toISOString();
  const rangeEnd = getAppointmentHorizonEnd(now).toISOString();

  const [appointments, professionals, locations, specialties, blocks, bookingSlug] = clinicId
    ? await Promise.all([
        supabase
          .from("appointments")
          .select(
            `${APPOINTMENT_AGENDA_COLUMNS}, patients(first_name, last_name, document_number), professionals(profiles(full_name)), locations(name), specialties(name)`
          )
          .eq("clinic_id", clinicId)
          .gte("start_at", rangeStart)
          .lte("start_at", rangeEnd)
          .order("start_at")
          .limit(APPOINTMENTS_AGENDA_MAX),
        getCachedClinicProfessionalsAgenda(clinicId),
        getCachedClinicLocations(clinicId),
        getCachedClinicSpecialties(clinicId),
        supabase
          .from("schedule_blocks")
          .select("start_at, end_at, reason")
          .eq("clinic_id", clinicId)
          .gte("start_at", rangeStart)
          .lte("start_at", rangeEnd),
        getCachedActiveBookingSlug(clinicId),
      ])
    : [{ data: [] }, [], [], [], { data: [] }, null];

  const professionalRows: ProfessionalAgendaRow[] = professionals as ProfessionalAgendaRow[];
  const defaultProfessionalId = clinicId
    ? await resolveDefaultProfessionalId(supabase, clinicId, professionalRows)
    : undefined;

  const appointmentRows: AppointmentAgendaRow[] = appointments.data ?? [];

  return (
    <>
      <Header
        title="Agenda médica"
        subtitle="Gestión de turnos y disponibilidad"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />
      <AgendaView
        appointments={appointmentRows}
        patients={[]}
        professionals={professionalRows}
        locations={locations}
        specialties={specialties}
        clinicId={clinicId}
        role={role}
        defaultDuration={clinic?.default_appointment_duration ?? 30}
        scheduleBlocks={blocks.data ?? []}
        bookingSlug={bookingSlug ?? clinic?.slug ?? null}
        defaultProfessionalId={defaultProfessionalId}
        isSuperadmin={isSuperadmin}
        permissionOverrides={permissionOverrides}
      />
    </>
  );
}
