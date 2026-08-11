import { redirect } from "next/navigation";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { DEFAULT_CLINIC_TIMEZONE } from "@/shared/utils/clinic-timezone";

import { BiReportView } from "@/features/reportes/components/bi-report-view";
import { loadBiReportPageData } from "@/features/reportes/server/load-bi-report-page";
import { parseBiReportPeriod } from "@/features/reportes/utils/bi-report";

export default async function BiReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period = parseBiReportPeriod(periodParam);
  const { profile, clinics, clinicId, role, isSuperadmin, permissionOverrides } =
    await getDashboardPageContext();

  if (!hasPermission(role, "viewReports", isSuperadmin, permissionOverrides)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const data = await loadBiReportPageData(
    supabase,
    clinicId,
    period,
    DEFAULT_CLINIC_TIMEZONE
  );

  return (
    <>
      <Header
        title="BI — Especialidad y cobertura"
        subtitle="Análisis de atenciones por obra social, especialidad y sede"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
        isSuperadmin={isSuperadmin}
      />
      <div className="p-4 sm:p-6">
        <BiReportView period={data.period} periodLabel={data.periodLabel} report={data.report} />
      </div>
    </>
  );
}
