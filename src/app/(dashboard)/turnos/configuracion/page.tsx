import { redirect } from "next/navigation";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { TurnosConfigView } from "@/features/turnos/components/turnos-config-view";
import { loadTurnosConfigPageData } from "@/features/turnos/server/load-turnos-config-page";

export default async function TurnosConfiguracionPage() {
  const ctx = await getDashboardPageContext();
  const { clinicId, role, isSuperadmin, permissionOverrides, clinics, profile } = ctx;

  if (!hasPermission(role, "manageSettings", isSuperadmin, permissionOverrides)) {
    redirect("/turnos/agenda");
  }

  if (!clinicId) {
    return (
      <>
        <Header
          title="Configuración"
          clinics={clinics}
          role={role}
          userName={profile?.full_name}
          isSuperadmin={isSuperadmin}
        />
        <p className="p-4 text-sm text-red-600">Seleccioná una clínica activa.</p>
      </>
    );
  }

  const supabase = await createClient();
  const data = await loadTurnosConfigPageData(supabase, clinicId);

  return (
    <>
      <Header
        title="Configuración de turnos"
        clinics={clinics}
        role={role}
        userName={profile?.full_name}
        isSuperadmin={isSuperadmin}
      />
      <div className="p-4">
        <TurnosConfigView {...data} />
      </div>
    </>
  );
}
