import { redirect } from "next/navigation";

import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/core/auth/session.server";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { LiquidacionListView } from "@/features/facturacion/components/liquidacion/liquidacion-list-view";
import { loadLiquidacionPageData } from "@/features/facturacion/server/load-liquidacion-page";

export default async function LiquidacionPage() {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!hasPermission(role, "manageCashRegister", isSuperadmin) || !clinicId) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const data = await loadLiquidacionPageData(supabase, clinicId);

  return (
    <>
      <Header
        title="Liquidación obras sociales"
        subtitle="Lotes de facturación y presentación a prepagas / obras sociales"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
        isSuperadmin={isSuperadmin}
      />
      <div className="p-4 sm:p-6">
        <LiquidacionListView batches={data.batches} pending={data.pending} />
      </div>
    </>
  );
}
