import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Suspense } from "react";

import { getDashboardShell } from "@/core/auth/session";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";

import { ClinicalOpsSecondarySkeleton } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-secondary-skeleton";
import { ClinicalOpsDashboardAsync } from "@/features/dashboard/components/dashboard/clinical-ops-dashboard-async";
import { ClinicalOpsDashboardBoundary } from "@/features/dashboard/components/dashboard/clinical-ops-dashboard-boundary";

export const dynamic = "force-dynamic";

function DashboardOpsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando operaciones del día">
      <div className="h-10 animate-pulse rounded-lg bg-slate-800/60" />
      <div className="grid gap-4 lg:grid-cols-[minmax(11rem,13rem)_minmax(0,1fr)]">
        <div className="hidden h-64 animate-pulse rounded-xl bg-slate-800/40 lg:block" />
        <div className="space-y-4">
          <div className="h-16 animate-pulse rounded-xl bg-slate-800/50" />
          <div className="h-40 animate-pulse rounded-xl bg-slate-800/50" />
          <ClinicalOpsSecondarySkeleton />
        </div>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const shell = await getDashboardShell();
  const { profile, clinics, clinicId, clinic, role, isSuperadmin } = shell;
  const now = new Date();

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
        {clinicId ? (
          <ClinicalOpsDashboardBoundary>
            <Suspense fallback={<DashboardOpsSkeleton />}>
              <ClinicalOpsDashboardAsync
                clinicId={clinicId}
                clinicName={clinic?.name ?? "Consultorio"}
                professionalName={profile?.full_name}
                canManageAppointments={hasPermission(role, "manageAppointments", isSuperadmin)}
                canManageCash={hasPermission(role, "manageCashRegister", isSuperadmin)}
                canManageWaitingRoom={hasPermission(role, "manageWaitingRoom", isSuperadmin)}
                canManageSettings={hasPermission(role, "manageSettings", isSuperadmin)}
              />
            </Suspense>
          </ClinicalOpsDashboardBoundary>
        ) : (
          <p className="text-sm text-slate-500">
            Seleccioná un consultorio para ver operaciones del día.
          </p>
        )}
      </div>
    </>
  );
}
