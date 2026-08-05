import { format } from "date-fns";
import { es } from "date-fns/locale";

import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/core/auth/session";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { ClinicalOperationsDashboard } from "@/features/dashboard/components/dashboard/clinical-operations-dashboard";
import { loadClinicalOperationsDashboard } from "@/features/dashboard/server/load-clinical-operations-dashboard";

export default async function DashboardPage() {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { clinic, role, isSuperadmin } = await getActiveClinic();
  const supabase = await createClient();
  const now = new Date();

  const ops = clinicId ? await loadClinicalOperationsDashboard(supabase, clinicId) : null;

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
        ) : (
          <p className="text-sm text-slate-500">Seleccioná un consultorio para ver operaciones del día.</p>
        )}
      </div>
    </>
  );
}
