import { redirect } from "next/navigation";

import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/core/auth/session";
import { Header } from "@/core/components/layout/header";
import { createClient } from "@/core/supabase/server";

import { patientClinicalHistoryPath } from "@/shared/utils/clinical-navigation";

import { HistoriasPageContent } from "@/features/historias/components/historias/historias-page-content";
import { loadHistoriasPageData } from "@/features/historias/server/load-historias-page";
import { sanitizePatientSearchTerm } from "@/features/pacientes/utils/patient-search";

export const maxDuration = 300;

export default async function HistoriasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; patient?: string; page?: string }>;
}) {
  const { q: qRaw, patient: patientIdParam, page: pageStr } = await searchParams;
  const q = sanitizePatientSearchTerm(qRaw);
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);

  if (patientIdParam && !q) {
    redirect(patientClinicalHistoryPath(patientIdParam));
  }

  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role } = await getActiveClinic();
  const supabase = await createClient();
  const pageData = await loadHistoriasPageData(supabase, clinicId, q, page);

  return (
    <>
      <Header
        title="Historia clínica digital"
        subtitle="Registro seguro de consultas médicas"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />
      <HistoriasPageContent q={q} {...pageData} />
    </>
  );
}
