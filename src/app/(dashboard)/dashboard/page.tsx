import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ConsultorioLivePanel } from "@/components/dashboard/consultorio-live-panel";
import { ClinicalWorkflowStrip } from "@/components/dashboard/clinical-workflow-strip";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  Calendar,
  Users,
  Stethoscope,
  XCircle,
  UserX,
  Plus,
  CalendarDays,
  Pill,
} from "lucide-react";
import { hasPermission } from "@/lib/permissions/roles";
import Link from "next/link";
import { DashboardUpcomingList } from "@/components/dashboard/dashboard-upcoming-list";
import { DashboardYearlyPatientsSection } from "@/components/dashboard/dashboard-yearly-patients-section";
import { BentoGrid, BentoCell } from "@/components/theme/bento-grid";
import { buildYearlyAttendedPatients } from "@/lib/utils/yearly-attended-patients";
import { format, startOfDay, endOfDay, startOfMonth, subYears } from "date-fns";
import { es } from "date-fns/locale";

export default async function DashboardPage() {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin, clinic } = await getActiveClinic();
  const supabase = await createClient();

  const now = new Date();
  const todayStart = startOfDay(now).toISOString();
  const todayEnd = endOfDay(now).toISOString();
  const monthStart = startOfMonth(now).toISOString();
  const yearStart = subYears(now, 1).toISOString();

  let yearlyAttendedPatients: ReturnType<typeof buildYearlyAttendedPatients> = [];

  let stats = {
    todayAppointments: 0,
    newPatients: 0,
    completedConsultations: 0,
    cancelledAppointments: 0,
    noShowCount: 0,
    totalMonthAppointments: 0,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let upcoming: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let todayQueue: any[] = [];
  let todayDone = 0;
  let nextToday: (typeof upcoming)[0] | null = null;

  if (clinicId) {
    const [today, newPats, attended, cancelled, noShow, monthTotal, upcomingData, todayList, yearAppointments, yearRecords] =
      await Promise.all([
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .gte("start_at", todayStart)
          .lte("start_at", todayEnd)
          .not("status", "eq", "cancelled"),
        supabase
          .from("patients")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .gte("created_at", monthStart),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .eq("status", "attended")
          .gte("start_at", monthStart),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .eq("status", "cancelled")
          .gte("start_at", monthStart),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .eq("status", "no_show")
          .gte("start_at", monthStart),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .gte("start_at", monthStart),
        supabase
          .from("appointments")
          .select(
            "id, start_at, status, booking_source, notes, patients(first_name, last_name, phone), professionals(profiles(full_name))"
          )
          .eq("clinic_id", clinicId)
          .gte("start_at", now.toISOString())
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
        supabase
          .from("appointments")
          .select(
            "patient_id, start_at, patients(id, first_name, last_name, document_number, birth_date, phone, email, insurance_provider)"
          )
          .eq("clinic_id", clinicId)
          .eq("status", "attended")
          .gte("start_at", yearStart),
        supabase
          .from("clinical_records")
          .select(
            "patient_id, created_at, patients(id, first_name, last_name, document_number, birth_date, phone, email, insurance_provider)"
          )
          .eq("clinic_id", clinicId)
          .gte("created_at", yearStart),
      ]);

    stats = {
      todayAppointments: today.count ?? 0,
      newPatients: newPats.count ?? 0,
      completedConsultations: attended.count ?? 0,
      cancelledAppointments: cancelled.count ?? 0,
      noShowCount: noShow.count ?? 0,
      totalMonthAppointments: monthTotal.count ?? 0,
    };
    upcoming = upcomingData.data ?? [];
    todayQueue = todayList.data ?? [];
    todayDone = todayQueue.filter((a) => a.status === "attended").length;
    const nowIso = now.toISOString();
    nextToday =
      todayQueue.find(
        (a) => a.status !== "attended" && a.status !== "no_show" && a.start_at >= nowIso
      ) ??
      todayQueue.find((a) => a.status !== "attended" && a.status !== "no_show") ??
      null;

    yearlyAttendedPatients = buildYearlyAttendedPatients(
      yearAppointments.data ?? [],
      yearRecords.data ?? []
    );
  }

  const noShowRate =
    stats.totalMonthAppointments > 0
      ? Math.round((stats.noShowCount / stats.totalMonthAppointments) * 100)
      : 0;

  return (
    <>
      <Header
        title="Dashboard"
        subtitle={`Resumen operativo — ${format(now, "EEEE d MMMM", { locale: es })}`}
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

        <BentoCell span={12}>
        <div className="drflow-bento-stats grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          <StatCard
            title="Turnos hoy"
            value={stats.todayAppointments}
            icon={<Calendar className="h-5 w-5" />}
          />
          <StatCard
            title="Pacientes nuevos"
            value={stats.newPatients}
            subtitle="Este mes"
            icon={<Users className="h-5 w-5" />}
          />
          <StatCard
            title="Consultas realizadas"
            value={stats.completedConsultations}
            subtitle="Este mes"
            icon={<Stethoscope className="h-5 w-5" />}
          />
          <StatCard
            title="Cancelaciones"
            value={stats.cancelledAppointments}
            subtitle="Este mes"
            icon={<XCircle className="h-5 w-5" />}
          />
          <StatCard
            title="Ausentismo"
            value={`${noShowRate}%`}
            subtitle={`${stats.noShowCount} ausencias`}
            icon={<UserX className="h-5 w-5" />}
          />
        </div>
        <div className="mt-4">
          <DashboardYearlyPatientsSection patients={yearlyAttendedPatients} />
        </div>
        </BentoCell>

        <BentoCell span={8}>
          <Card
            className="h-full"
            title="Próximos turnos"
            action={
              <Link href="/agenda">
                <Button variant="outline" size="sm">
                  Ver agenda
                </Button>
              </Link>
            }
          >
            {upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Sin turnos próximos"
                description="Cuando programes turnos, aparecerán acá."
                action={
                  <Link href="/agenda">
                    <Button size="sm">
                      <Plus className="h-4 w-4" />
                      Nuevo turno
                    </Button>
                  </Link>
                }
              />
            ) : (
              <DashboardUpcomingList
                appointments={upcoming}
                canManage={hasPermission(role, "manageAppointments", isSuperadmin)}
              />
            )}
          </Card>
        </BentoCell>

          <BentoCell span={4}>
          <Card title="Accesos rápidos" className="h-full">
            <div className="grid gap-2">
              <Link href="/atenciones">
                <Button variant="outline" className="w-full justify-start">
                  Registro de atenciones
                </Button>
              </Link>
              <Link href="/agenda?action=new">
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="h-4 w-4" />
                  Nuevo turno
                </Button>
              </Link>
              <Link href="/pacientes/nuevo">
                <Button variant="outline" className="w-full justify-start">
                  <Users className="h-4 w-4" />
                  Nuevo paciente
                </Button>
              </Link>
              <Link href="/historias/nueva">
                <Button variant="outline" className="w-full justify-start">
                  <Stethoscope className="h-4 w-4" />
                  Nueva consulta
                </Button>
              </Link>
              <Link href="/reportes">
                <Button variant="outline" className="w-full justify-start">
                  <CalendarDays className="h-4 w-4" />
                  Ver reportes
                </Button>
              </Link>
              {hasPermission(role, "viewPharmacology", isSuperadmin) && (
                <>
                  <Link href="/herramientas/farmacologia">
                    <Button variant="outline" className="w-full justify-start">
                      <Pill className="h-4 w-4" />
                      Guía farmacológica
                    </Button>
                  </Link>
                  <Link href="/herramientas/farmacologia?mode=symptoms">
                    <Button variant="outline" className="w-full justify-start">
                      <Pill className="h-4 w-4" />
                      Buscar por síntomas
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </Card>
          </BentoCell>
        </BentoGrid>
      </div>
    </>
  );
}
