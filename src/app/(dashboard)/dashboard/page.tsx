import { format } from "date-fns";
import { es } from "date-fns/locale";

import { getDashboardShell } from "@/core/auth/session";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { ClinicalOperationsDashboard } from "@/features/dashboard/components/dashboard/clinical-operations-dashboard";
import { ClinicalOpsDashboardBoundary } from "@/features/dashboard/components/dashboard/clinical-ops-dashboard-boundary";
import { loadClinicalOperationsDashboard } from "@/features/dashboard/server/load-clinical-operations-dashboard";
import { normalizeClinicalOpsPayload } from "@/features/dashboard/utils/normalize-clinical-ops-payload";

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

function DashboardPageFallback({ message }: { message: string }) {
  return (
    <div className="p-6">
      <p className="text-sm text-amber-700">{message}</p>
    </div>
  );
}

async function DashboardPageContent() {
  const data = await loadDashboardPageData();
  if (!data) {
    return (
      <DashboardPageFallback message="No pudimos cargar el dashboard. Refrescá la página o probá de nuevo en unos segundos." />
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
          <ClinicalOpsDashboardBoundary>
            <ClinicalOperationsDashboard
              clinicId={clinicId}
              clinicName={clinic?.name ?? "Consultorio"}
              professionalName={profile?.full_name}
              ops={normalizeClinicalOpsPayload(ops)}
              canManageAppointments={hasPermission(role, "manageAppointments", isSuperadmin)}
              canManageCash={hasPermission(role, "manageCashRegister", isSuperadmin)}
              canManageWaitingRoom={hasPermission(role, "manageWaitingRoom", isSuperadmin)}
              canManageSettings={hasPermission(role, "manageSettings", isSuperadmin)}
            />
          </ClinicalOpsDashboardBoundary>
        ) : clinicId ? (
          <DashboardPageFallback message="No pudimos cargar operaciones del día. Refrescá la página o probá de nuevo en unos segundos." />
        ) : (
          <p className="text-sm text-slate-500">
            Seleccioná un consultorio para ver operaciones del día.
          </p>
        )}
      </div>
    </>
  );
}

export default async function DashboardPage() {
  try {
    return await DashboardPageContent();
  } catch (err) {
    console.error("[dashboard] page render failed:", err);
    return (
      <DashboardPageFallback message="No pudimos cargar el dashboard. Refrescá la página o probá de nuevo en unos segundos." />
    );
  }
}
