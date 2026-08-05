import { addDays, subDays } from "date-fns";

import {
  getDashboardPageContext,
} from "@/core/auth/dashboard-page";
import { APPOINTMENT_AGENDA_COLUMNS } from "@/core/supabase/select-columns";
import { createClient } from "@/core/supabase/server";

import { AgendaView } from "@/features/agenda";

import {
  getCachedActiveBookingSlug,
  getCachedClinicLocations,
  getCachedClinicProfessionalsAgenda,
  getCachedClinicSpecialties,
} from "@/lib/server/cached-clinic-queries";

async function AgendaContent({
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
            .order("start_at"),
          supabase
            .from("patients")
            .select("id, first_name, last_name, document_number")
            .eq("clinic_id", clinicId)
            .eq("is_active", true)
            .order("last_name")
            .limit(200),
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

  return (
    <AgendaView
      initialView={initialView}
      initialShowForm={initialShowForm}
      appointments={(appointments.data ?? []) as never}
      patients={patients.data ?? []}
      professionals={professionals as never}
      locations={locations}
      specialties={specialties}
      clinics={clinics}
      clinicId={clinicId}
      role={role}
      userName={profile?.full_name}
      defaultDuration={clinic?.default_appointment_duration ?? 30}
      scheduleBlocks={blocks.data ?? []}
      bookingSlug={bookingSlug ?? clinic?.slug ?? null}
    />
  );
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; action?: string }>;
}) {
  const { view, action } = await searchParams;
  const initialView =
    view === "day" ? "day" : view === "month" ? "month" : "week";

  return (
    <AgendaContent initialView={initialView} initialShowForm={action === "new"} />
  );
}
