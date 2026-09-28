import { redirect } from "next/navigation";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { Header } from "@/core/components/layout/header";

import { getMedicalOrderPermissions } from "@/features/ordenes-medicas/actions/medical-orders-v2";
import { MedicalOrdersBrowser } from "@/features/ordenes-medicas/components/medical-orders-browser";

export default async function OrdenesMedicasPage() {
  const { profile, clinics, clinicId, role } = await getDashboardPageContext();
  if (!clinicId) redirect("/login");

  const permissions = await getMedicalOrderPermissions();
  if (!permissions.canView) redirect("/dashboard");

  return (
    <>
      <Header
        title="Órdenes médicas"
        subtitle="Laboratorio, imágenes, interconsultas y prácticas del consultorio"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />
      <div className="p-4 sm:p-6">
        <MedicalOrdersBrowser permissions={permissions} />
      </div>
    </>
  );
}
