import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/core/auth/session.server";

import NuevoPacienteForm from "./nuevo-paciente-form";

export default async function NuevoPacientePage() {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, clinic } = await getActiveClinic();

  return (
    <NuevoPacienteForm
      clinics={clinics}
      clinicId={clinicId}
      role={role}
      userName={profile?.full_name}
      defaultInsurance={clinic?.default_insurance_provider}
      acceptedCoverages={clinic?.accepted_coverages ?? null}
    />
  );
}
