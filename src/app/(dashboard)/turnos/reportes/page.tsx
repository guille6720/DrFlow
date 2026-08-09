import { redirect } from "next/navigation";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { TurnosReportesView } from "@/features/turnos/components/turnos-reportes-view";
import { loadTurnosReportesPageData } from "@/features/turnos/server/load-turnos-config-page";

export default async function TurnosReportesPage() {
  const ctx = await getDashboardPageContext();
  const { clinicId, role, isSuperadmin, permissionOverrides, clinics, profile } = ctx;

  if (!hasPermission(role, "viewReports", isSuperadmin, permissionOverrides)) {
    redirect("/turnos/agenda");
  }

  if (!clinicId) {
    return (
      <>
        <Header
          title="Reportes"
          clinics={clinics}
          role={role}
          userName={profile?.full_name}
          isSuperadmin={isSuperadmin}
        />
        <p className="p-4 text-sm text-red-600">Seleccioná una clínica activa.</p>
      </>
    );
  }

  const supabase = await createClient();
  const { metrics } = await loadTurnosReportesPageData(supabase, clinicId);

  return (
    <>
      <Header
        title="Reportes de turnos"
        clinics={clinics}
        role={role}
        userName={profile?.full_name}
        isSuperadmin={isSuperadmin}
      />
      <div className="p-4">
        <TurnosReportesView metrics={metrics} />
      </div>
    </>
  );
}
