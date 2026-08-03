import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ConsultorioLivePanel } from "@/components/dashboard/consultorio-live-panel";
import { ClinicalWorkflowStrip } from "@/components/dashboard/clinical-workflow-strip";
import { DashboardStatsSection } from "@/components/dashboard/dashboard-stats-section";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Plus, CalendarDays, Pill, Users, Stethoscope, Calendar } from "lucide-react";
import { hasPermission } from "@/lib/permissions/roles";
import Link from "next/link";
import { DashboardUpcomingList } from "@/components/dashboard/dashboard-upcoming-list";
import { DashboardYearlyPatientsSection } from "@/components/dashboard/dashboard-yearly-patients-section";
import { BentoGrid, BentoCell } from "@/components/theme/bento-grid";
import { buildDashboardStatsDetail } from "@/lib/utils/build-dashboard-stats-detail";
import { buildYearlyAttendedPatients } from "@/lib/utils/yearly-attended-patients";
import { getAttendancePeriodBounds } from "@/lib/utils/attendance-stats";
import { DEFAULT_CLINIC_TIMEZONE } from "@/lib/utils/clinic-timezone";
import type { DashboardStatsDetail } from "@/lib/utils/dashboard-stats-types";
import { format, startOfDay, endOfDay, startOfMonth, subYears } from "date-fns";
import { es } from "date-fns/locale";

const APPOINTMENT_DETAIL_SELECT =
  "id, start_at, status, patient_id, cancellation_reason, patients(first_name, last_name, document_number), professionals(profiles(full_name))";

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
  let dashboardStatsDetail: DashboardStatsDetail | null = null;

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
    const timeZone = clinic?.timezone ?? DEFAULT_CLINIC_TIMEZONE;
    const weekBounds = getAttendancePeriodBounds("weekly", now, timeZone);

    const [today, newPats, attended, cancelled, noShow, monthTotal, upcomingData, todayList, yearAppointments, yearRecords, todayDetailRows, newPatientsRows, attendedRows, cancelledRows, noShowRows, weekNoShow, weekTotal] =
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
        supabase
          .from("appointments")
          .select(APPOINTMENT_DETAIL_SELECT)
          .eq("clinic_id", clinicId)
          .gte("start_at", todayStart)
          .lte("start_at", todayEnd)
          .order("start_at")
          .limit(100),
        supabase
          .from("patients")
          .select("id, first_name, last_name, document_number, created_at")
          .eq("clinic_id", clinicId)
          .gte("created_at", monthStart)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("appointments")
          .select(APPOINTMENT_DETAIL_SELECT)
          .eq("clinic_id", clinicId)
          .eq("status", "attended")
          .gte("start_at", monthStart)
          .order("start_at", { ascending: false })
          .limit(100),
        supabase
          .from("appointments")
          .select(APPOINTMENT_DETAIL_SELECT)
          .eq("clinic_id", clinicId)
          .eq("status", "cancelled")
          .gte("start_at", monthStart)
          .order("start_at", { ascending: false })
          .limit(100),
        supabase
          .from("appointments")
          .select(APPOINTMENT_DETAIL_SELECT)
          .eq("clinic_id", clinicId)
          .eq("status", "no_show")
          .gte("start_at", monthStart)
          .order("start_at", { ascending: false })
          .limit(100),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .eq("status", "no_show")
          .gte("start_at", weekBounds.start.toISOString())
          .lt("start_at", weekBounds.end.toISOString()),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .gte("start_at", weekBounds.start.toISOString())
          .lt("start_at", weekBounds.end.toISOString()),
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

    dashboardStatsDetail = buildDashboardStatsDetail({
      timeZone,
      referenceDate: now,
      todayAppointments: todayDetailRows.data ?? [],
      newPatients: newPatientsRows.data ?? [],
      attendedConsultations: attendedRows.data ?? [],
      cancelledAppointments: cancelledRows.data ?? [],
      noShowAppointments: noShowRows.data ?? [],
      weekNoShowCount: weekNoShow.count ?? 0,
      weekTotalAppointments: weekTotal.count ?? 0,
      counts: stats,
    });
  }

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
        {dashboardStatsDetail ? (
          <DashboardStatsSection detail={dashboardStatsDetail} />
        ) : null}
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
