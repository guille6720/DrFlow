import { format } from "date-fns";
import { es } from "date-fns/locale";

import { getDashboardShell, resolveClinicDisplayName } from "@/core/auth/session";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { TurnosDashboardTodayView } from "@/features/turnos/components/turnos-dashboard-today-view";
import { loadTurnosReportesPageData } from "@/features/turnos/server/load-turnos-config-page";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const shell = await getDashboardShell();
  const { profile, clinics, clinicId, clinic, role, isSuperadmin } = shell;
  const clinicDisplayName = resolveClinicDisplayName(clinicId, clinic, clinics) ?? "Consultorio";
  const now = new Date();

  let todayMetrics = null;
  if (clinicId) {
    const supabase = await createClient();
    const { metrics } = await loadTurnosReportesPageData(supabase, clinicId);
    todayMetrics = metrics;
  }

  return (
    <>
      <Header
        title="Dashboard"
        subtitle={`${clinicDisplayName} · ${format(now, "EEEE d MMMM", { locale: es })}`}
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
        isSuperadmin={isSuperadmin}
      />

      <div className="p-4 sm:p-6">
        {clinicId && todayMetrics ? (
          <TurnosDashboardTodayView
            metrics={todayMetrics}
            canViewReports={hasPermission(role, "viewReports", isSuperadmin)}
          />
        ) : (
          <p className="text-sm text-slate-500">
            Seleccioná un consultorio para ver operaciones del día.
          </p>
        )}
      </div>
    </>
  );
}
