import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import NuevoPacienteForm from "./patient-form";

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
    />
  );
}
