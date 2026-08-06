import { redirect } from "next/navigation";

import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

export default async function RecetasPage({
  searchParams,
}: {
  searchParams: Promise<{
    patient?: string;
    tipo?: string;
    consulta?: string;
    appointment?: string;
    professional?: string;
  }>;
}) {
  const { patient: patientId, tipo, professional: professionalParam, consulta } = await searchParams;

  if (patientId) {
    redirect(
      buildPatientWorkspaceUrl(patientId, {
        tab: tipo === "orden" ? "ordenes" : "recetas",
        action: "nueva",
        professional: professionalParam,
        consulta,
      })
    );
  }

  redirect("/pacientes");
}
