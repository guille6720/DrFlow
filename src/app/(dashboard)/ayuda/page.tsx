import { ManualView } from "@/components/manual/manual-view";
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header";
import { getAppVersion, getLatestChangelog } from "@/lib/app-release";

export default async function AyudaPage() {
  const latest = getLatestChangelog();

  return (
    <>
      <DashboardPageHeader
        title="Ayuda y manual"
        subtitle={`Versión ${getAppVersion()} · Actualizado ${latest.date}`}
      />
      <div className="p-4 sm:p-6">
        <ManualView />
      </div>
    </>
  );
}
