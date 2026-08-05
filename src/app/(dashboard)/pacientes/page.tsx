import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/core/auth/session";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { PacientesPageContent } from "@/features/pacientes/components/pacientes/pacientes-page-content";
import { loadPacientesPageData } from "@/features/pacientes/server/load-pacientes-page";
import { sanitizePatientSearchTerm } from "@/features/pacientes/utils/patient-search";

export const maxDuration = 300;

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; cobertura?: string }>;
}) {
  const { q: qRaw, page: pageStr, cobertura } = await searchParams;
  const q = sanitizePatientSearchTerm(qRaw);
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  const canIssuePrescriptions = hasPermission(role, "issuePrescriptions", isSuperadmin);
  const supabase = await createClient();
  const pageData = await loadPacientesPageData(supabase, clinicId, q, page, cobertura);

  return (
    <>
      <Header
        title="Pacientes"
        subtitle={`${pageData.total} pacientes activos`}
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />
      <PacientesPageContent
        q={q}
        cobertura={cobertura}
        canIssuePrescriptions={canIssuePrescriptions}
        {...pageData}
      />
    </>
  );
}
