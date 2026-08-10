import { endOfDay, startOfDay } from "date-fns";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/core/auth/session.server";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { CashRegisterView } from "@/features/caja";
import { AdminOpsAnalyticsBridge } from "@/features/ia/components/admin-ops/admin-ops-analytics-bridge";

import { Button } from "@/components/ui/button";
import {
  getCachedClinicProfessionalsAgenda,
  getCachedClinicSettings,
} from "@/lib/server/cached-clinic-queries";
import { loadPatientPickerList } from "@/lib/server/load-patient-picker-list";
import { loadRevenueSnapshot } from "@/lib/server/load-revenue-snapshot";
import { resolveDefaultProfessionalId } from "@/lib/server/resolve-default-professional";
import { getProfessionalDisplayName } from "@/lib/utils/professional";

export default async function CajaPage() {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!hasPermission(role, "manageCashRegister", isSuperadmin)) {
    redirect("/dashboard");
  }

  if (!clinicId) redirect("/dashboard");

  const supabase = await createClient();

  if (role === "doctor" && !isSuperadmin) {
    const clinicSettings = await getCachedClinicSettings(clinicId);
    if (clinicSettings && clinicSettings.doctors_can_access_cash === false) {
      redirect("/dashboard");
    }
  }

  const todayStart = startOfDay(new Date()).toISOString();
  const todayEnd = endOfDay(new Date()).toISOString();

  const [{ patients }, professionals, { data: charges }, analytics] =
    await Promise.all([
    loadPatientPickerList(supabase, clinicId),
    getCachedClinicProfessionalsAgenda(clinicId),
    supabase
      .from("cash_charges")
      .select("id, charged_at, amount, charge_kind, payment_method, status, motive, patients(first_name, last_name)")
      .eq("clinic_id", clinicId)
      .gte("charged_at", todayStart)
      .lte("charged_at", todayEnd)
      .order("charged_at", { ascending: false })
      .limit(50),
    loadRevenueSnapshot(supabase, clinicId),
  ]);

  const defaultProfessionalId = await resolveDefaultProfessionalId(
    supabase,
    clinicId,
    (professionals ?? []).map((p) => ({ id: p.id }))
  );

  return (
    <>
      <Header
        title="Caja"
        subtitle="Cobranzas y movimientos"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />
      <div className="p-4 sm:p-6">
        <AdminOpsAnalyticsBridge
          analytics={analytics}
          page="caja"
          canManageCash
          canViewReports={hasPermission(role, "viewReports", isSuperadmin)}
        />
        <div className="mb-4 flex flex-wrap gap-2">
          <Link href="/caja/cierre">
            <Button variant="outline" size="sm">
              Cierre diario
            </Button>
          </Link>
          <Link href="/caja/reportes">
            <Button variant="outline" size="sm">
              Reportes
            </Button>
          </Link>
          <Link href="/caja/cuenta-corriente">
            <Button variant="outline" size="sm">
              Cuenta corriente
            </Button>
          </Link>
        </div>
        <CashRegisterView
          defaultProfessionalId={defaultProfessionalId}
          patients={(patients ?? []).map((p) => ({
            id: p.id,
            label: `${p.last_name}, ${p.first_name} — DNI ${p.document_number}`,
          }))}
          professionals={(professionals ?? []).map((p) => {
            const prof = p as {
              id: string;
              display_name?: string | null;
              profiles?: { full_name?: string } | { full_name?: string }[] | null;
            };
            const profile = Array.isArray(prof.profiles) ? prof.profiles[0] : prof.profiles;
            return {
              id: prof.id,
              label: getProfessionalDisplayName({ ...prof, profiles: profile ?? null }),
            };
          })}
          recentCharges={(charges ?? []).map((c) => {
            const p = Array.isArray(c.patients) ? c.patients[0] : c.patients;
            return {
              ...c,
              amount: Number(c.amount),
              patients: p ?? null,
            };
          })}
        />
      </div>
    </>
  );
}
