import { endOfDay, startOfDay } from "date-fns";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/core/auth/session.server";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { WaitingRoomView } from "@/features/administracion";

import { Button } from "@/components/ui/button";

export default async function SalaEsperaPage() {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!hasPermission(role, "manageWaitingRoom", isSuperadmin) || !clinicId) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const dayStart = startOfDay(new Date()).toISOString();
  const dayEnd = endOfDay(new Date()).toISOString();

  const { data: appointments } = await supabase
    .from("appointments")
    .select(
      "id, start_at, waiting_room_status, patients(first_name, last_name, document_number), professionals(display_name, profiles(full_name))"
    )
    .eq("clinic_id", clinicId)
    .gte("start_at", dayStart)
    .lte("start_at", dayEnd)
    .neq("status", "cancelled")
    .order("start_at");

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
      <div className="p-4 sm:p-6">
        <Link href="/agenda" className="mb-4 inline-block">
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
