import { format } from "date-fns";
import { es } from "date-fns/locale";

import { getDashboardShell } from "@/core/auth/session";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { ClinicalOperationsDashboard } from "@/features/dashboard/components/dashboard/clinical-operations-dashboard";
import { loadClinicalOperationsDashboard } from "@/features/dashboard/server/load-clinical-operations-dashboard";

export const dynamic = "force-dynamic";

async function loadDashboardPageData() {
  const shell = await getDashboardShell();
  const supabase = await createClient();

  let ops: Awaited<ReturnType<typeof loadClinicalOperationsDashboard>> | null = null;
  if (shell.clinicId) {
    try {
      ops = await loadClinicalOperationsDashboard(supabase, shell.clinicId);
    } catch (err) {
      console.error("[dashboard] loadClinicalOperationsDashboard failed:", err);
    }
  }

  return { ...shell, ops, now: new Date() };
}

export default async function DashboardPage() {
  let data: Awaited<ReturnType<typeof loadDashboardPageData>> | null = null;

  try {
    data = await loadDashboardPageData();
  } catch (err) {
    console.error("[dashboard] page data load failed:", err);
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-sm text-amber-700">
          No pudimos cargar el dashboard. Refrescá la página o probá de nuevo en unos segundos.
        </p>
      </div>
    );
  }

  const { profile, clinics, clinicId, clinic, role, isSuperadmin, ops, now } = data;

  return (
    <>
      <Header
        title="Centro de operaciones clínicas"
        subtitle={format(now, "EEEE d MMMM", { locale: es })}
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
        isSuperadmin={isSuperadmin}
      />

      <div className="p-4 sm:p-6">
        {ops && clinicId ? (
          <ClinicalOperationsDashboard
            clinicId={clinicId}
            clinicName={clinic?.name ?? "Consultorio"}
            professionalName={profile?.full_name}
            ops={ops}
            canManageAppointments={hasPermission(role, "manageAppointments", isSuperadmin)}
            canManageCash={hasPermission(role, "manageCashRegister", isSuperadmin)}
            canManageWaitingRoom={hasPermission(role, "manageWaitingRoom", isSuperadmin)}
            canManageSettings={hasPermission(role, "manageSettings", isSuperadmin)}
          />
        ) : clinicId ? (
          <p className="text-sm text-amber-700">
            No pudimos cargar operaciones del día. Refrescá la página o probá de nuevo en unos segundos.
          </p>
        ) : (
          <p className="text-sm text-slate-500">
            Seleccioná un consultorio para ver operaciones del día.
          </p>
        )}
      </div>
    </>
  );
}
