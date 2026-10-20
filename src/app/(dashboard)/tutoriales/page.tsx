import { redirect } from "next/navigation";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { DashboardPageHeader } from "@/core/components/layout/dashboard-page-header";

import { TutorialesCatalog } from "@/features/tutoriales";
import type { TutorialAudienceRole } from "@/features/tutoriales/types";

import type { UserRole } from "@/types/database";

function toAudienceRole(role: UserRole | null, isSuperadmin: boolean): TutorialAudienceRole | null {
  if (isSuperadmin || role === "superadmin") return "superadmin";
  if (role === "clinic_admin" || role === "doctor" || role === "secretary") return role;
  return null;
}

export default async function TutorialesPage() {
  const shell = await getDashboardPageContext();
  if (!shell.profile) redirect("/login");

  const audience = toAudienceRole(shell.role, shell.isSuperadmin);
  if (!audience) redirect("/dashboard");

  const organizationId = shell.clinic?.id;
  if (!organizationId) redirect("/dashboard");

  return (
    <>
      <DashboardPageHeader
        title="Tutoriales"
        subtitle="Aprendé NexClinic con recorridos guiados sobre pantallas reales"
      />
      <div className="p-4 sm:p-6">
        <TutorialesCatalog
          audienceRole={audience}
          clinicRole={shell.role}
          isSuperadmin={shell.isSuperadmin}
          permissionOverrides={shell.permissionOverrides}
          organizationId={organizationId}
          userId={shell.profile.id}
        />
      </div>
    </>
  );
}
