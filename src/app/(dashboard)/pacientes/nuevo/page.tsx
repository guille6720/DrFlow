import { getDashboardPageContext } from "@/core/auth/dashboard-page";

import { parsePatientSearchQueryForPrefill } from "@/features/pacientes/utils/create-patient-from-search";

import NuevoPacienteForm from "./nuevo-paciente-form";

export default async function NuevoPacientePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; return?: string }>;
}) {
  const params = await searchParams;
  const { profile, clinics, clinicId, role, clinic } = await getDashboardPageContext();
  const prefill = params.q ? parsePatientSearchQueryForPrefill(params.q) : undefined;
  const returnPath =
    params.return && params.return.startsWith("/") && !params.return.startsWith("//")
      ? params.return
      : undefined;

  return (
    <NuevoPacienteForm
      clinics={clinics}
      clinicId={clinicId}
      role={role}
      userName={profile?.full_name}
      defaultInsurance={clinic?.default_insurance_provider}
      acceptedCoverages={clinic?.accepted_coverages ?? null}
      prefill={prefill}
      returnPath={returnPath}
    />
  );
}
