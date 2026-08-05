import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/core/auth/session";
import { Header } from "@/core/components/layout/header";
import { parsePageParam } from "@/core/supabase/pagination";
import { createClient } from "@/core/supabase/server";

import { DEFAULT_CLINIC_TIMEZONE } from "@/shared/utils/clinic-timezone";

import { PatientAttendanceRegister } from "@/features/administracion/components/atenciones/patient-attendance-register";
import {
  buildAtencionesUrl,
  loadAtencionesPageData,
} from "@/features/administracion/server/load-atenciones-page";

import type { AttendancePeriod } from "@/lib/utils/attendance-stats";

const VALID_PERIODS = new Set<AttendancePeriod>(["daily", "weekly", "monthly"]);

export default async function AtencionesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; page?: string }>;
}) {
  const { period: periodParam, page: pageParam } = await searchParams;
  const period: AttendancePeriod = VALID_PERIODS.has(periodParam as AttendancePeriod)
    ? (periodParam as AttendancePeriod)
    : "daily";
  const page = parsePageParam(pageParam);

  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, clinic } = await getActiveClinic();
  const supabase = await createClient();

  const timeZone = clinic?.timezone ?? DEFAULT_CLINIC_TIMEZONE;
  const data = await loadAtencionesPageData(supabase, clinicId, period, page, timeZone);

  return (
    <>
      <Header
        title="Registro de atenciones"
        subtitle="Pacientes atendidos por día, semana y mes"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />

      <div className="p-4 sm:p-6">
        <PatientAttendanceRegister
          period={data.period}
          periodLabel={data.periodLabel}
          summary={data.summary}
          items={data.items}
          pageMeta={data.pageMeta}
          buildPageHref={(p) => buildAtencionesUrl(period, p)}
        />
      </div>
    </>
  );
}
