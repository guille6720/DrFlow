import { RecordatoriosView } from "@/components/recordatorios/recordatorios-view";
import {
  getActiveClinicId,
  getProfile,
  getUserClinics,
  getActiveClinic,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function RecordatoriosPage() {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role } = await getActiveClinic();
  const supabase = await createClient();

  const [logs, appointments] = clinicId
    ? await Promise.all([
        supabase
          .from("reminder_logs")
          .select("*")
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("appointments")
          .select("id, start_at, patients(first_name, last_name)")
          .eq("clinic_id", clinicId)
          .in("status", ["pending", "confirmed"])
          .gte("start_at", new Date().toISOString())
          .order("start_at")
          .limit(20),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <RecordatoriosView
      logs={logs.data ?? []}
      pendingAppointments={appointments.data ?? []}
      clinics={clinics}
      clinicId={clinicId}
      role={role}
      userName={profile?.full_name}
    />
  );
}
