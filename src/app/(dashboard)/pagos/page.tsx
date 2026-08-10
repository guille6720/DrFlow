import { redirect } from "next/navigation";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { hasPermission } from "@/core/permissions/roles";
import { parsePageParam } from "@/core/supabase/pagination";
import { createClient } from "@/core/supabase/server";

import { PagosView } from "@/features/facturacion/components/pagos/pagos-view";
import { buildPagosUrl, loadPagosPageData } from "@/features/facturacion/server/load-pagos-page";

export default async function PagosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = parsePageParam(sp.page);

  const { profile, clinics, clinicId, role, isSuperadmin } = await getDashboardPageContext();

  if (!hasPermission(role, "managePayments", isSuperadmin)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const pagosData = clinicId
    ? await loadPagosPageData(supabase, clinicId, page)
    : {
        payments: [],
        pageMeta: { page: 1, pageSize: 30, total: 0, totalPages: 1 },
      };

  return (
    <PagosView
      payments={pagosData.payments}
      pageMeta={pagosData.pageMeta}
      buildPageHref={buildPagosUrl}
      clinics={clinics}
      clinicId={clinicId}
      role={role}
      userName={profile?.full_name}
    />
  );
}
