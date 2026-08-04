import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { HistoriasPageContent } from "@/components/historias/historias-page-content";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { sanitizePatientSearchTerm } from "@/lib/utils/patient-search";
import { patientClinicalHistoryPath } from "@/lib/utils/clinical-navigation";
import { loadHistoriasPageData } from "@/lib/server/load-historias-page";

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
