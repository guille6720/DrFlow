import { redirect } from "next/navigation";

import { DashboardPageHeader } from "@/core/components/layout/dashboard-page-header";
import { ProductRequiredError } from "@/core/products/products.server";

import { NuevoResidenteForm } from "@/features/geriatria/components/nuevo-residente-form";
import { requireGeriatricsClinic } from "@/features/geriatria/server/geriatrics.server";
import { listFreeGeriatricsBeds } from "@/features/geriatria/server/residents.server";

import { ButtonLink } from "@/components/ui/button";

export default async function NuevoResidentePage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>;
}) {
  let clinicId: string;
  try {
    ({ clinicId } = await requireGeriatricsClinic());
  } catch (err) {
    if (err instanceof ProductRequiredError) redirect("/sin-productos");
    redirect("/dashboard");
  }

  const params = await searchParams;
  const freeBeds = await listFreeGeriatricsBeds(clinicId);

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Nuevo residente"
        subtitle="Vinculá un paciente de la clínica como residente. Una sola identidad."
      />
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/geriatria/residentes" variant="outline">
          ← Volver a residentes
        </ButtonLink>
        <ButtonLink href="/pacientes/nuevo?return=/geriatria/residentes/nuevo" variant="outline">
          Crear paciente nuevo
        </ButtonLink>
      </div>
      <NuevoResidenteForm freeBeds={freeBeds} defaultPatientId={params.patientId} />
    </div>
  );
}
