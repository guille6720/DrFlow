import { addDays, subDays } from "date-fns";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { APPOINTMENTS_AGENDA_MAX, PATIENT_PICKER_INITIAL_LIMIT } from "@/core/supabase/pagination";
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

async function TurnosAgendaContent({
  initialView,
  initialShowForm,
}: {
  initialView: "day" | "week" | "month";
  initialShowForm: boolean;
}) {
  const { profile, clinics, clinicId, clinic, role } = await getDashboardPageContext();
  const supabase = await createClient();

  const rangeStart = subDays(new Date(), 7).toISOString();
  const rangeEnd = addDays(new Date(), 30).toISOString();

  const [appointments, patients, professionals, locations, specialties, blocks, bookingSlug] =
    clinicId
      ? await Promise.all([
          supabase
            .from("appointments")
            .select(
              `${APPOINTMENT_AGENDA_COLUMNS}, patients(first_name, last_name), professionals(profiles(full_name)), locations(name), specialties(name)`
            )
            .eq("clinic_id", clinicId)
            .gte("start_at", rangeStart)
            .lte("start_at", rangeEnd)
            .order("start_at")
            .limit(APPOINTMENTS_AGENDA_MAX),
          supabase
            .from("patients")
            .select("id, first_name, last_name, document_number")
            .eq("clinic_id", clinicId)
            .eq("is_active", true)
            .order("last_name")
            .limit(PATIENT_PICKER_INITIAL_LIMIT),
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
      : [{ data: [] }, { data: [] }, [], [], [], { data: [] }, null];

  const defaultProfessionalId = clinicId
    ? await resolveDefaultProfessionalId(supabase, clinicId, professionals as Array<{ id: string }>)
    : undefined;

  const appointmentRows: AppointmentAgendaRow[] = appointments.data ?? [];
  const professionalRows: ProfessionalAgendaRow[] = professionals;

  return (
    <AgendaView
      initialView={initialView}
      initialShowForm={initialShowForm}
      appointments={appointmentRows}
      patients={patients.data ?? []}
      professionals={professionalRows}
      locations={locations}
      specialties={specialties}
      clinics={clinics}
      clinicId={clinicId}
      role={role}
      userName={profile?.full_name}
      defaultDuration={clinic?.default_appointment_duration ?? 30}
      scheduleBlocks={blocks.data ?? []}
      bookingSlug={bookingSlug ?? clinic?.slug ?? null}
      defaultProfessionalId={defaultProfessionalId}
    />
  );
}

export default async function TurnosAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; action?: string }>;
}) {
  const { view, action } = await searchParams;
  const initialView = view === "day" ? "day" : view === "month" ? "month" : "week";

  return (
    <TurnosAgendaContent initialView={initialView} initialShowForm={action === "new"} />
  );
}
