import { notFound, redirect } from "next/navigation";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { LiquidacionBatchView } from "@/features/facturacion/components/liquidacion/liquidacion-batch-view";
import { loadLiquidacionDetailPageData } from "@/features/facturacion/server/load-liquidacion-detail-page";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function LiquidacionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { profile, clinics, clinicId, role, isSuperadmin } = await getDashboardPageContext();

  if (!hasPermission(role, "manageCashRegister", isSuperadmin) || !clinicId) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const data = await loadLiquidacionDetailPageData(supabase, clinicId, id);

  if (!data.batch) {
    notFound();
  }

  return (
    <>
      <Header
        title="Detalle de liquidación"
        subtitle={data.batch.insurance_provider}
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
        isSuperadmin={isSuperadmin}
      />
      <div className="p-4 sm:p-6">
        <LiquidacionBatchView batch={data.batch} items={data.items} />
      </div>
    </>
  );
}
