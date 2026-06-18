import { redirect } from "next/navigation";
import { PharmacologySearchView } from "@/components/pharmacology/pharmacology-search-view";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/roles";
import type { PharmacologySearchMode } from "@/types/pharmacology";

export default async function FarmacologiaPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  const params = await searchParams;

  if (!hasPermission(role, "viewPharmacology", isSuperadmin)) {
    redirect("/dashboard");
  }

  const initialMode: PharmacologySearchMode =
    params.mode === "symptoms" ? "symptoms" : "pathology";

  return (
    <PharmacologySearchView
      clinics={clinics}
      clinicId={clinicId}
      role={role}
      userName={profile?.full_name}
      initialMode={initialMode}
    />
  );
}
