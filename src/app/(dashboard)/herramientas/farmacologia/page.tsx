import { redirect } from "next/navigation";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { hasPermission } from "@/core/permissions/roles";

import { PharmacologySearchView } from "@/features/pharmacology";

import type { PharmacologySearchMode } from "@/types/pharmacology";

export default async function FarmacologiaPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { profile, clinics, clinicId, role, isSuperadmin } = await getDashboardPageContext();
  const params = await searchParams;

  if (!hasPermission(role, "viewPharmacology", isSuperadmin)) {
    redirect("/dashboard");
  }

  const initialMode: PharmacologySearchMode =
    params.mode === "symptoms"
      ? "symptoms"
      : params.mode === "vademecum"
        ? "vademecum"
        : "pathology";

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
