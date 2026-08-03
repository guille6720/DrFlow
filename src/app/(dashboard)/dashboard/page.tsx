import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClinicalOperationsCenter } from "@/features/dashboard";
import { ConsultorioLivePanel } from "@/features/dashboard";
import type { LiveAppointment } from "@/components/dashboard/consultorio-live-panel";
import { ClinicalWorkflowStrip } from "@/features/dashboard";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Calendar, Pill, Users, Stethoscope } from "lucide-react";
import { hasPermission } from "@/lib/permissions/roles";
import Link from "next/link";
import { loadClinicalOperationsData } from "@/lib/server/load-clinical-operations-data";
import { BentoGrid, BentoCell } from "@/components/theme/bento-grid";
import { format, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";

export default async function DashboardPage() {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  const supabase = await createClient();

  const now = new Date();
  const todayStart = startOfDay(now).toISOString();
  const todayEnd = endOfDay(now).toISOString();
  const nowIso = now.toISOString();

  let stats = { todayAppointments: 0 };
  let upcoming: LiveAppointment[] = [];
  let todayQueue: LiveAppointment[] = [];
  let todayDone = 0;
  let nextToday: LiveAppointment | null = null;
  let clinicalOps = null;

  if (clinicId) {
    const [today, upcomingData, todayList] = await Promise.all([
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .gte("start_at", todayStart)
        .lte("start_at", todayEnd)
        .not("status", "eq", "cancelled"),
      supabase
        .from("appointments")
        .select(
          "id, start_at, status, booking_source, notes, patient_id, professional_id, patients(first_name, last_name, phone), professionals(profiles(full_name))"
        )
        .eq("clinic_id", clinicId)
        .gte("start_at", nowIso)
        .not("status", "in", '("cancelled","attended")')
        .order("start_at")
        .limit(8),
      supabase
        .from("appointments")
        .select(
          "id, start_at, status, booking_source, patient_id, professional_id, patients(first_name, last_name, phone), professionals(profiles(full_name))"
        )
        .eq("clinic_id", clinicId)
        .gte("start_at", todayStart)
        .lte("start_at", todayEnd)
        .not("status", "in", '("cancelled")')
        .order("start_at"),
    ]);

    stats = { todayAppointments: today.count ?? 0 };
    upcoming = (upcomingData.data ?? []) as unknown as LiveAppointment[];
    todayQueue = (todayList.data ?? []) as unknown as LiveAppointment[];
    todayDone = todayQueue.filter((a) => a.status === "attended").length;
    nextToday =
      todayQueue.find(
        (a) => a.status !== "attended" && a.status !== "no_show" && a.start_at >= nowIso
      ) ??
      todayQueue.find((a) => a.status !== "attended" && a.status !== "no_show") ??
      null;

    clinicalOps = await loadClinicalOperationsData(supabase, {
      clinicId,
      nowIso,
      todayQueue,
      upcoming,
    });
  }

  return (
    <>
      <Header
        title="Centro de operaciones"
        subtitle={`Consultorio — ${format(now, "EEEE d MMMM", { locale: es })}`}
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
        isSuperadmin={isSuperadmin}
      />

      <div className="p-4 sm:p-6">
        <BentoGrid className="gap-6">
          <BentoCell span={12}>
            <ConsultorioLivePanel
              todayTotal={stats.todayAppointments}
              todayDone={todayDone}
              next={nextToday}
              todayQueue={todayQueue}
            />
          </BentoCell>

          <BentoCell span={12}>
            <ClinicalWorkflowStrip />
          </BentoCell>

          {clinicalOps ? (
            <BentoCell span={12}>
              <ClinicalOperationsCenter
                ops={clinicalOps}
                canManageAppointments={hasPermission(role, "manageAppointments", isSuperadmin)}
              />
            </BentoCell>
          ) : null}

          <BentoCell span={12}>
            <Card title="Accesos rápidos">
              <div className="flex flex-wrap gap-2">
                <Link href="/agenda?action=new">
                  <Button variant="outline" size="sm">
                    <Calendar className="h-4 w-4" />
                    Nuevo turno
                  </Button>
                </Link>
                <Link href="/pacientes/nuevo">
                  <Button variant="outline" size="sm">
                    <Users className="h-4 w-4" />
                    Nuevo paciente
                  </Button>
                </Link>
                <Link href="/historias/nueva">
                  <Button variant="outline" size="sm">
                    <Stethoscope className="h-4 w-4" />
                    Nueva consulta
                  </Button>
                </Link>
                <Link href="/recetas">
                  <Button variant="outline" size="sm">
                    <Pill className="h-4 w-4" />
                    Recetas
                  </Button>
                </Link>
                <Link href="/atenciones">
                  <Button variant="outline" size="sm">
                    Registro atenciones
                  </Button>
                </Link>
                <Link href="/reportes">
                  <Button variant="outline" size="sm">
                    Reportes
                  </Button>
                </Link>
              </div>
            </Card>
          </BentoCell>
        </BentoGrid>
      </div>
    </>
  );
}
