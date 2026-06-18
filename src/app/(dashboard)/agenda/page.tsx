import { AgendaView } from "@/components/agenda/agenda-view";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { subDays, addDays } from "date-fns";

async function AgendaContent({
  initialView,
  initialShowForm,
}: {
  initialView: "day" | "week" | "month";
  initialShowForm: boolean;
}) {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { clinic, role } = await getActiveClinic();
  const supabase = await createClient();

  const rangeStart = subDays(new Date(), 7).toISOString();
  const rangeEnd = addDays(new Date(), 30).toISOString();

  const [appointments, patients, professionals, locations, specialties, blocks, booking] =
    clinicId
      ? await Promise.all([
          supabase
            .from("appointments")
            .select(
              "*, patients(first_name, last_name), professionals(profiles(full_name)), locations(name), specialties(name)"
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
          supabase
            .from("professionals")
            .select("*, profiles(full_name), specialties(name)")
            .eq("clinic_id", clinicId)
            .eq("is_active", true),
          supabase.from("locations").select("id, name").eq("clinic_id", clinicId),
          supabase.from("specialties").select("id, name").eq("clinic_id", clinicId),
          supabase
            .from("schedule_blocks")
            .select("start_at, end_at, reason")
            .eq("clinic_id", clinicId)
            .gte("start_at", rangeStart)
            .lte("start_at", rangeEnd),
          supabase
            .from("public_booking_links")
            .select("slug")
            .eq("clinic_id", clinicId)
            .eq("is_active", true)
            .maybeSingle(),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: null }];

  return (
    <AgendaView
      initialView={initialView}
      initialShowForm={initialShowForm}
      appointments={appointments.data ?? []}
      patients={patients.data ?? []}
      professionals={professionals.data ?? []}
      locations={locations.data ?? []}
      specialties={specialties.data ?? []}
      clinics={clinics}
      clinicId={clinicId}
      role={role}
      userName={profile?.full_name}
      defaultDuration={clinic?.default_appointment_duration ?? 30}
      scheduleBlocks={blocks.data ?? []}
      bookingSlug={booking.data?.slug ?? clinic?.slug ?? null}
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
