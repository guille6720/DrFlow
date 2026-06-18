import { TelemedicinaView } from "@/components/telemedicina/telemedicina-view";
import {
  getActiveClinicId,
  getProfile,
  getUserClinics,
  getActiveClinic,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function TelemedicinaPage() {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role } = await getActiveClinic();
  const supabase = await createClient();

  const [sessions, appointments] = clinicId
    ? await Promise.all([
        supabase
          .from("telemedicine_sessions")
          .select("*, appointments(start_at, patients(first_name, last_name))")
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
