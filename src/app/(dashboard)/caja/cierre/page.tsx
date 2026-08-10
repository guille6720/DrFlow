import { endOfDay, format, startOfDay } from "date-fns";
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

import { CashClosureView } from "@/features/caja";
import { loadCashClosureDayTotals } from "@/features/caja/server/load-cash-closure-day-totals";
import { AdminOpsAnalyticsBridge } from "@/features/ia/components/admin-ops/admin-ops-analytics-bridge";

import { Button } from "@/components/ui/button";
import { loadRevenueSnapshot } from "@/lib/server/load-revenue-snapshot";

export default async function CajaCierrePage() {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!hasPermission(role, "manageCashRegister", isSuperadmin) || !clinicId) {
    redirect("/dashboard");
  }

  const date = format(new Date(), "yyyy-MM-dd");
  const supabase = await createClient();

  const [{ data: closure }, analytics] = await Promise.all([
    supabase
      .from("cash_daily_closures")
      .select(
        "id, clinic_id, closure_date, totals, patient_count, consultation_count, cash_difference, notes, closed_by, closed_at"
      )
      .eq("clinic_id", clinicId)
      .eq("closure_date", date)
      .maybeSingle(),
    loadRevenueSnapshot(supabase, clinicId),
  ]);

  let totals: Record<string, number> = (closure?.totals as Record<string, number>) ?? {};
  let patientCount = closure?.patient_count ?? 0;
  let consultationCount = closure?.consultation_count ?? 0;

  if (!closure) {
    const dayStart = startOfDay(new Date()).toISOString();
    const dayEnd = endOfDay(new Date()).toISOString();
    const dayTotals = await loadCashClosureDayTotals(supabase, clinicId, dayStart, dayEnd);
    totals = dayTotals.totals;
    patientCount = dayTotals.patientCount;
    consultationCount = dayTotals.consultationCount;
  }

  return (
    <>
      <Header
        title="Cierre de caja"
        subtitle={format(new Date(), "PPP", { locale: undefined })}
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />
      <div className="p-4 sm:p-6">
        <AdminOpsAnalyticsBridge analytics={analytics} page="caja" canManageCash />
        <Link href="/caja" className="mb-4 inline-block">
          <Button variant="outline" size="sm">
            Volver a caja
          </Button>
        </Link>
        <CashClosureView
          date={date}
          totals={totals}
          patientCount={patientCount}
          consultationCount={consultationCount}
          existingNotes={closure?.notes}
        />
      </div>
    </>
  );
}
