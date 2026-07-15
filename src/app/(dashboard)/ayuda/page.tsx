import { Header } from "@/components/layout/header";
import { ManualView } from "@/components/manual/manual-view";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { getAppVersion, getLatestChangelog } from "@/lib/app-release";

export default async function AyudaPage() {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role } = await getActiveClinic();
  const latest = getLatestChangelog();

  return (
    <>
      <Header
        title="Ayuda y manual"
        subtitle={`Versión ${getAppVersion()} · Actualizado ${latest.date}`}
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />
      <div className="p-4 sm:p-6">
        <ManualView />
      </div>
    </>
  );
}
