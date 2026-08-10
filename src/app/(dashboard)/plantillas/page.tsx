import { redirect } from "next/navigation";

import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/core/auth/session.server";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";

import { ClinicalTemplatesManager } from "@/features/historias/components/historias/clinical-templates-manager";

import {
  getCachedClinicalTemplatesAdmin,
  getCachedClinicSpecialties,
} from "@/lib/server/cached-clinic-queries";

export default async function PlantillasPage() {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!clinicId) {
    redirect("/login");
  }

  if (!hasPermission(role, "editClinicalRecords", isSuperadmin)) {
    redirect("/dashboard");
  }

  const [templates, specialties] = await Promise.all([
    getCachedClinicalTemplatesAdmin(clinicId),
    getCachedClinicSpecialties(clinicId),
  ]);

  return (
    <>
      <Header
        title="Plantillas clínicas"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />
      <div className="p-4 sm:p-6">
        <p className="mb-4 text-sm text-slate-700">
          Textos reutilizables para evoluciones y consultas. Aparecen al escribir una evolución
          clínica.
        </p>
        <ClinicalTemplatesManager
          templates={templates}
          specialties={specialties.map((s) => ({ id: s.id, name: s.name }))}
        />
      </div>
    </>
  );
}
