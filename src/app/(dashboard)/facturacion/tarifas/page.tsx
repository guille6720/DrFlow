import Link from "next/link";
import { redirect } from "next/navigation";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { OsFeeSchedulesPanel } from "@/features/facturacion/components/liquidacion/os-fee-schedules-panel";
import { loadOsFeeSchedulesPageData } from "@/features/facturacion/server/load-os-fee-schedules-page";

import { Button } from "@/components/ui/button";

export default async function OsTarifasPage() {
  const { profile, clinics, clinicId, role, isSuperadmin } = await getDashboardPageContext();

  if (!hasPermission(role, "manageCashRegister", isSuperadmin) || !clinicId) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const schedules = await loadOsFeeSchedulesPageData(supabase, clinicId);

  return (
    <>
      <Header
        title="Tarifas obras sociales"
        subtitle="Importes de consulta para liquidación"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
        isSuperadmin={isSuperadmin}
      />
      <div className="p-4 sm:p-6">
        <Link href="/facturacion/liquidacion" className="mb-4 inline-block">
          <Button variant="outline" size="sm">
            ← Liquidación
          </Button>
        </Link>
        <OsFeeSchedulesPanel schedules={schedules} />
      </div>
    </>
  );
}
