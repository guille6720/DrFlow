import Link from "next/link";
import { redirect } from "next/navigation";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { TURNOS_TODAY_SCAN_MAX } from "@/core/supabase/pagination";
import { createClient } from "@/core/supabase/server";

import {
  clinicActiveQueueRange,
  DEFAULT_CLINIC_TIMEZONE,
} from "@/shared/utils/clinic-timezone";

import { WaitingRoomView } from "@/features/administracion";

import { Button } from "@/components/ui/button";

export default async function SalaEsperaPage() {
  const { profile, clinics, clinicId, role, isSuperadmin, clinic } = await getDashboardPageContext();

  if (!hasPermission(role, "manageWaitingRoom", isSuperadmin) || !clinicId) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const timeZone = clinic?.timezone?.trim() || DEFAULT_CLINIC_TIMEZONE;
  const { startIso, endExclusiveIso } = clinicActiveQueueRange(new Date(), timeZone);

  const { data: appointments } = await supabase
    .from("appointments")
    .select(
      "id, start_at, waiting_room_status, waiting_room_entered_at, patients(first_name, last_name, document_number), professionals(display_name, profiles(full_name))"
    )
    .eq("clinic_id", clinicId)
    .gte("start_at", startIso)
    .lt("start_at", endExclusiveIso)
    .neq("status", "cancelled")
    .not("waiting_room_entered_at", "is", null)
    .order("start_at")
    .limit(TURNOS_TODAY_SCAN_MAX);

  return (
    <>
      <Header
        title="Sala de espera"
        subtitle="Estado en tiempo real"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />
      <div className="p-3 sm:p-4">
        <Link href="/turnos/agenda" className="mb-4 inline-block">
          <Button variant="outline" size="sm">
            Ir a agenda
          </Button>
        </Link>
        <WaitingRoomView
          clinicId={clinicId}
          initialRows={(appointments ?? []).map((a) => {
            const pro = Array.isArray(a.professionals) ? a.professionals[0] : a.professionals;
            const profProfile = pro?.profiles;
            const profile = Array.isArray(profProfile) ? profProfile[0] : profProfile;
            return {
              id: a.id,
              start_at: a.start_at,
              waiting_room_status: a.waiting_room_status,
              waiting_room_entered_at: a.waiting_room_entered_at,
              patients: Array.isArray(a.patients) ? a.patients[0] ?? null : a.patients,
              professionals: pro
                ? { display_name: pro.display_name, profiles: profile ?? null }
                : null,
            };
          })}
        />
      </div>
    </>
  );
}
