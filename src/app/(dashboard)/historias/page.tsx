import { redirect } from "next/navigation";

import { patientClinicalHistoryPath } from "@/shared/utils/clinical-navigation";

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

  if (q) {
    redirect(
      `/pacientes?seccion=historias&q=${encodeURIComponent(q)}${page > 1 ? `&page=${page}` : ""}`
    );
  }

  redirect("/pacientes?seccion=historias");
}
