import { redirect } from "next/navigation";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { canAccessRoute } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { TelemedicinaView } from "@/features/telemedicina";

const TELEMEDICINE_SESSION_COLUMNS =
  "id, clinic_id, appointment_id, room_url, status, started_at, ended_at, created_at";

export default async function TelemedicinaPage() {
  const { profile, clinics, clinicId, role, isSuperadmin } = await getDashboardPageContext();

  if (!canAccessRoute(role, "/telemedicina", isSuperadmin)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  const [sessions, appointments] = clinicId
    ? await Promise.all([
        supabase
          .from("telemedicine_sessions")
          .select(`${TELEMEDICINE_SESSION_COLUMNS}, appointments(start_at, patients(first_name, last_name))`)
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("appointments")
          .select("id, start_at, patients(first_name, last_name)")
          .eq("clinic_id", clinicId)
          .gte("start_at", new Date().toISOString())
          .not("status", "in", '("cancelled","attended")')
          .order("start_at")
          .limit(20),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <TelemedicinaView
      sessions={sessions.data ?? []}
      appointments={appointments.data ?? []}
      clinics={clinics}
      clinicId={clinicId}
      role={role}
      userName={profile?.full_name}
    />
  );
}
