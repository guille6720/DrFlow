import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { parsePageParam } from "@/core/supabase/pagination";
import { createClient } from "@/core/supabase/server";

import { WaitingListView } from "@/features/turnos/components/waiting-list-view";
import {
  buildWaitingListUrl,
  loadWaitingListPageData,
} from "@/features/turnos/server/load-waiting-list-page";

export default async function TurnosListaEsperaPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const page = parsePageParam(sp.page);
  const q = sp.q ?? "";

  const ctx = await getDashboardPageContext();
  const { clinicId, role, isSuperadmin, permissionOverrides, clinics, profile } = ctx;

  if (!hasPermission(role, "manageAppointments", isSuperadmin, permissionOverrides)) {
    return (
      <>
        <Header
          title="Lista de espera"
          clinics={clinics}
          role={role}
          userName={profile?.full_name}
          isSuperadmin={isSuperadmin}
        />
        <p className="p-4 text-sm text-red-600">No tenés permiso para ver la lista de espera.</p>
      </>
    );
  }

  const supabase = await createClient();
  const data = clinicId
    ? await loadWaitingListPageData(supabase, clinicId, q, page)
    : {
        entries: [],
        pageMeta: { page: 1, pageSize: 25, total: 0, totalPages: 1 },
        searchQuery: q,
      };

  return (
    <>
      <Header
        title="Lista de espera"
        clinics={clinics}
        role={role}
        userName={profile?.full_name}
        isSuperadmin={isSuperadmin}
      />
      <div className="p-4">
        <WaitingListView
          entries={data.entries}
          pageMeta={data.pageMeta}
          searchQuery={data.searchQuery}
          buildPageHref={(nextPage) => buildWaitingListUrl(nextPage, data.searchQuery)}
        />
      </div>
    </>
  );
}
