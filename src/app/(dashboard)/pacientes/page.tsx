import {
  getDashboardPageContext,
} from "@/core/auth/dashboard-page";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { parsePageParam } from "@/core/supabase/pagination";
import { createClient } from "@/core/supabase/server";

import { loadHistoriasPageData } from "@/features/historias/server/load-historias-page";
import { PacientesPageContent } from "@/features/pacientes/components/pacientes/pacientes-page-content";
import { loadPacientesPageData } from "@/features/pacientes/server/load-pacientes-page";
import {
  type PacientesPageSection,
  parsePacientesPageSection,
} from "@/features/pacientes/utils/pacientes-page-url";
import { sanitizePatientPathologySearchTerm, sanitizePatientSearchTerm } from "@/features/pacientes/utils/patient-search";

export const maxDuration = 300;

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    cobertura?: string;
    patologia?: string;
    seccion?: string;
    cursor?: string;
    before?: string;
  }>;
}) {
  const {
    q: qRaw,
    page: pageStr,
    cobertura,
    patologia: patologiaRaw,
    seccion: seccionRaw,
    cursor,
    before,
  } = await searchParams;
  const q = sanitizePatientSearchTerm(qRaw);
  const patologia = sanitizePatientPathologySearchTerm(patologiaRaw);
  const page = parsePageParam(pageStr);

  const { profile, clinics, clinicId, role, isSuperadmin } = await getDashboardPageContext();
  const canIssuePrescriptions = hasPermission(role, "issuePrescriptions", isSuperadmin);
  const canViewClinical = hasPermission(role, "viewClinicalRecords", isSuperadmin);
  const supabase = await createClient();

  const seccion: PacientesPageSection =
    canViewClinical && parsePacientesPageSection(seccionRaw) === "historias"
      ? "historias"
      : "pacientes";

  const historiasData =
    seccion === "historias" && canViewClinical
      ? await loadHistoriasPageData(supabase, clinicId, q, page, { cursor, before })
      : null;

  const pageData =
    seccion === "historias" && canViewClinical
      ? {
          patients: [],
          total: 0,
          portalSlug: null,
          doctorInfo: null,
          shareByPatient: new Map<
            string,
            { sharedAt: string; sharedByName?: string | null; channel?: string | null }
          >(),
          totalPages: 1,
          page,
        }
      : await loadPacientesPageData(supabase, clinicId, q, page, cobertura, patologia);

  const headerSubtitle =
    seccion === "historias"
      ? `${historiasData?.clinicTotalRecords ?? 0} consultas en la clínica`
      : `${pageData.total} pacientes activos`;

  return (
    <>
      <Header
        title="Pacientes"
        subtitle={headerSubtitle}
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />
      <PacientesPageContent
        seccion={seccion}
        q={q}
        patologia={patologia}
        cobertura={cobertura}
        canIssuePrescriptions={canIssuePrescriptions}
        canViewClinical={canViewClinical}
        historiasData={historiasData}
        {...pageData}
      />
    </>
  );
}
