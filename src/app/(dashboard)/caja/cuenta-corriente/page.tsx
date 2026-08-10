import { redirect } from "next/navigation";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { hasPermission } from "@/core/permissions/roles";
import { parsePageParam } from "@/core/supabase/pagination";
import { createClient } from "@/core/supabase/server";

import { CuentaCorrienteView } from "@/features/caja/components/caja/cuenta-corriente-view";
import {
  buildCuentaCorrienteUrl,
  loadCuentaCorrientePageData,
} from "@/features/caja/server/load-cuenta-corriente-page";

export default async function CuentaCorrientePage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = parsePageParam(sp.page);
  const { profile, clinics, clinicId, role, isSuperadmin } = await getDashboardPageContext();

  if (!hasPermission(role, "manageCashRegister", isSuperadmin) || !clinicId) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const data = await loadCuentaCorrientePageData(supabase, clinicId, sp.patient, page);

  return (
    <CuentaCorrienteView
      selectedPatient={data.selectedPatient}
      entries={data.entries}
      balance={data.balance}
      pageMeta={data.pageMeta}
      buildPageHref={(nextPage) =>
        data.selectedPatient
          ? buildCuentaCorrienteUrl(data.selectedPatient.id, nextPage)
          : "/caja/cuenta-corriente"
      }
      clinics={clinics}
      clinicId={clinicId}
      role={role}
      userName={profile?.full_name}
    />
  );
}
