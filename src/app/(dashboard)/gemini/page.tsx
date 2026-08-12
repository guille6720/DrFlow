import { redirect } from "next/navigation";

import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/core/auth/session.server";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";

import { GeminiWorkspaceClient } from "@/features/ia/components/clinical-workflow/gemini-workspace-client";

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
      <div className="p-3 sm:p-4">
        <p className="mb-4 text-sm text-slate-700">
          Preguntá estadísticas o candidatos a protocolos. Los resultados quedan en el historial
          para que puedas abrir un paciente y volver sin buscar de nuevo.
        </p>
        <GeminiWorkspaceClient />
      </div>
    </>
  );
}
