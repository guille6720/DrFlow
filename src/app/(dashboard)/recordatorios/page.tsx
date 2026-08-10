import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { createClient } from "@/core/supabase/server";

import { RecordatoriosView } from "@/features/agenda/components/recordatorios/recordatorios-view";

const REMINDER_LOG_COLUMNS =
  "id, clinic_id, appointment_id, recipient, channel, status, message, sent_at, error_message, created_at";

export default async function RecordatoriosPage() {
  const { profile, clinics, clinicId, role } = await getDashboardPageContext();
  const supabase = await createClient();

  const [logs, appointments] = clinicId
    ? await Promise.all([
        supabase
          .from("reminder_logs")
          .select(REMINDER_LOG_COLUMNS)
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
