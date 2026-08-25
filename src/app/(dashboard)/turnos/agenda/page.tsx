import { subDays } from "date-fns";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { Header } from "@/core/components/layout/header";
import { selectAppointmentAgendaRows } from "@/core/supabase/appointment-agenda-select";
import { APPOINTMENTS_AGENDA_MAX, SCHEDULE_BLOCKS_AGENDA_MAX } from "@/core/supabase/pagination";
import type { ProfessionalAgendaRow } from "@/core/supabase/query-types";
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

  const professionalsPromise = clinicId
    ? getCachedClinicProfessionalsAgenda(clinicId)
    : Promise.resolve([] as ProfessionalAgendaRow[]);

  const [agendaResult, professionals, locations, specialties, blocks, bookingSlug, defaultProfessionalId] =
    clinicId
      ? await Promise.all([
          selectAppointmentAgendaRows(supabase, {
            clinicId,
            rangeStart,
            rangeEnd,
            embedPatients: true,
            embedRelations: true,
            limit: APPOINTMENTS_AGENDA_MAX,
          }),
          professionalsPromise,
          getCachedClinicLocations(clinicId),
          getCachedClinicSpecialties(clinicId),
          supabase
            .from("schedule_blocks")
            .select("start_at, end_at, reason")
            .eq("clinic_id", clinicId)
            .gte("start_at", rangeStart)
            .lte("start_at", rangeEnd)
            .limit(SCHEDULE_BLOCKS_AGENDA_MAX),
          getCachedActiveBookingSlug(clinicId),
          professionalsPromise.then((pros) =>
            resolveDefaultProfessionalId(supabase, clinicId, pros as ProfessionalAgendaRow[])
          ),
        ])
      : [{ rows: [], error: null }, [], [], [], { data: [] }, null, undefined];

  const professionalRows: ProfessionalAgendaRow[] = professionals as ProfessionalAgendaRow[];

  const appointmentRows = agendaResult.rows;

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
