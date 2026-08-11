import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/core/auth/session.server";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";

import { LiquidacionCreateForm } from "@/features/facturacion/components/liquidacion/liquidacion-create-form";

import { Button } from "@/components/ui/button";

export default async function LiquidacionNuevaPage() {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!hasPermission(role, "manageCashRegister", isSuperadmin) || !clinicId) {
    redirect("/dashboard");
  }

  return (
    <>
      <Header
        title="Nuevo lote"
        subtitle="Liquidación obras sociales"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
        isSuperadmin={isSuperadmin}
      />
      <div className="p-4 sm:p-6">
        <Link href="/facturacion/liquidacion" className="mb-4 inline-block">
          <Button variant="outline" size="sm">
            ← Volver
          </Button>
        </Link>
        <LiquidacionCreateForm />
      </div>
    </>
  );
}
