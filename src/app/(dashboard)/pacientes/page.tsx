import { Header } from "@/components/layout/header";
import { PacientesPageContent } from "@/components/pacientes/pacientes-page-content";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { sanitizePatientSearchTerm } from "@/lib/utils/patient-search";
import { hasPermission } from "@/lib/permissions/roles";
import { loadPacientesPageData } from "@/lib/server/load-pacientes-page";

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
