import { redirect } from "next/navigation";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { PrescriptionTemplatesManager } from "@/features/recetas/components/recetas/prescription-templates-manager";
import { listPrescriptionTemplatesForClinic } from "@/features/recetas/repositories/prescription-templates.repository";

import { getCachedClinicProfessionalsList } from "@/lib/server/cached-clinic-queries";
import { resolveDefaultProfessionalId } from "@/lib/server/resolve-default-professional";

export default async function PlantillasRecetasPage() {
  const { profile, clinics, clinicId, role, isSuperadmin } = await getDashboardPageContext();

  if (!clinicId) {
    redirect("/login");
  }

  if (!hasPermission(role, "issuePrescriptions", isSuperadmin)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const [templatesResult, professionals] = await Promise.all([
    listPrescriptionTemplatesForClinic(supabase, clinicId),
    getCachedClinicProfessionalsList(clinicId),
  ]);

  const templates = templatesResult.ok ? templatesResult.data : [];
  const professionalRows = professionals.map((p) => ({
    id: p.id,
    display_name: p.display_name,
    license_number: p.license_number,
    profiles: Array.isArray(p.profiles) ? p.profiles[0] ?? null : p.profiles,
  }));
  const defaultProfessionalId = await resolveDefaultProfessionalId(
    supabase,
    clinicId,
    professionalRows
  );

  return (
    <>
      <Header
        title="Plantillas de recetas"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />
      <div className="p-4 sm:p-6">
        <p className="mb-4 text-sm text-slate-700">
          Combinaciones de medicamentos reutilizables. Al aplicar una plantilla en el wizard, se
          prefieren los datos pero siempre hay que revisar y confirmar antes de emitir.
        </p>
        <PrescriptionTemplatesManager
          templates={templates}
          professionals={professionalRows}
          defaultProfessionalId={defaultProfessionalId ?? undefined}
        />
      </div>
    </>
  );
}
