import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Suspense } from "react";

import { getDashboardShell, resolveClinicDisplayName } from "@/core/auth/session";
import { Header } from "@/core/components/layout/header";
import { canUseEnforcedFeature } from "@/core/entitlements/entitlements.server";
import { FEATURES } from "@/core/entitlements/features";
import { hasPermission } from "@/core/permissions/roles";

import { ClinicalOpsDashboardAsync } from "@/features/dashboard/components/dashboard/clinical-ops-dashboard-async";

import { PageSkeleton } from "@/components/ui/page-skeleton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const shell = await getDashboardShell();
  const { profile, clinics, clinicId, clinic, role, isSuperadmin, permissionOverrides } = shell;
  const clinicDisplayName = resolveClinicDisplayName(clinicId, clinic, clinics) ?? "Consultorio";
  const now = new Date();

  return (
    <>
      <Header
        title="Dashboard"
        subtitle={`${clinicDisplayName} · ${format(now, "EEEE d MMMM", { locale: es })}`}
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
        isSuperadmin={isSuperadmin}
      />

      <div className="p-3 sm:p-4">
        {clinicId ? (
          <Suspense fallback={<PageSkeleton title="Operaciones del día" />}>
            <ClinicalOpsDashboardAsync
              clinicId={clinicId}
              clinicName={clinicDisplayName}
              professionalName={profile?.full_name}
              canManageAppointments={hasPermission(
                role,
                "manageAppointments",
                isSuperadmin,
                permissionOverrides
              )}
              canManageCash={
                hasPermission(
                  role,
                  "manageCashRegister",
                  isSuperadmin,
                  permissionOverrides
                ) && (await canUseEnforcedFeature(FEATURES.CASH_REGISTER))
              }
              canManageWaitingRoom={hasPermission(
                role,
                "manageWaitingRoom",
                isSuperadmin,
                permissionOverrides
              )}
              canManageSettings={hasPermission(
                role,
                "manageSettings",
                isSuperadmin,
                permissionOverrides
              )}
            />
          </Suspense>
        ) : (
          <p className="text-sm text-slate-500">
            Seleccioná un consultorio para ver operaciones del día.
          </p>
        )}
      </div>
    </>
  );
}
