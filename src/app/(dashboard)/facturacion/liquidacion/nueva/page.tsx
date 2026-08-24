import Link from "next/link";
import { redirect } from "next/navigation";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";

import { LiquidacionCreateForm } from "@/features/facturacion/components/liquidacion/liquidacion-create-form";

import { Button } from "@/components/ui/button";

export default async function LiquidacionNuevaPage() {
  const { profile, clinics, clinicId, role, isSuperadmin } = await getDashboardPageContext();

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
