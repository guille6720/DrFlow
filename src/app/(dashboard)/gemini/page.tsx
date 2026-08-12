import { redirect } from "next/navigation";

import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/core/auth/session.server";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";

import { GeminiWorkspace } from "@/features/ia/components/clinical-workflow/gemini-workspace";

export default async function GeminiPage() {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!clinicId) {
    redirect("/login");
  }

  if (!hasPermission(role, "viewClinicalRecords", isSuperadmin)) {
    redirect("/dashboard");
  }

  return (
    <>
      <Header
        title="Gemini"
        subtitle="Asistente clínico dentro de DrFlow"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />
      <div className="p-4 sm:p-6">
        <p className="mb-4 text-sm text-slate-700">
          Preguntá sobre un paciente. DrFlow valida tu rol, lee la historia clínica en el
          servidor y envía a Gemini un contexto anonimizado.
        </p>
        <GeminiWorkspace />
      </div>
    </>
  );
}
