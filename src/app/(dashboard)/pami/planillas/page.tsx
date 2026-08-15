import { redirect } from "next/navigation";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { parsePageParam } from "@/core/supabase/pagination";
import { createClient } from "@/core/supabase/server";

import { sanitizePatientSearchTerm } from "@/features/pacientes/utils/patient-search";
import { PamiPlanillasView } from "@/features/pami";
import { getPamiMessages } from "@/features/pami/i18n";
import { PAMI_PLANILLA_FALLBACK_CATALOG } from "@/features/pami/seed/pami-planilla-fallback-catalog";
import {
  buildPamiPlanillasUrl,
  loadPamiPlanillasPageData,
} from "@/features/pami/server/load-pami-planillas-page";

export default async function PamiPlanillasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q: qRaw, page: pageParam } = await searchParams;
  const q = sanitizePatientSearchTerm(qRaw);
  const page = parsePageParam(pageParam);

  const { profile, clinics, clinicId, role, isSuperadmin } = await getDashboardPageContext();
  const supabase = await createClient();

  if (!hasPermission(role, "issuePrescriptions", isSuperadmin)) {
    redirect("/dashboard");
  }

  const data = clinicId
    ? await loadPamiPlanillasPageData(supabase, clinicId, profile?.id, q, page)
    : {
        patients: [],
        professionals: [],
        catalog: PAMI_PLANILLA_FALLBACK_CATALOG,
        catalogSource: "fallback" as const,
        defaultProfessionalId: undefined,
        pageMeta: { page: 1, pageSize: 50, total: 0, totalPages: 1 },
        searchQuery: q,
      };

  const t = getPamiMessages().planillas;

  return (
    <>
      <Header
        title={t.page.title}
        subtitle={t.page.subtitle}
        titleId="pami-planillas-heading"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />

      <main id="pami-planillas-main" aria-labelledby="pami-planillas-heading" className="p-4 sm:p-6">
        <PamiPlanillasView
          patients={data.patients}
          professionals={data.professionals}
          catalog={data.catalog}
          defaultProfessionalId={data.defaultProfessionalId}
          pageMeta={data.pageMeta}
          searchQuery={data.searchQuery}
          buildPageHref={(p) => buildPamiPlanillasUrl(q, p)}
        />
      </main>
    </>
  );
}
