import { redirect } from "next/navigation";
import Link from "next/link";
import { format, startOfDay, endOfDay } from "date-fns";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { CashClosureView } from "@/components/caja/cash-closure-view";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/roles";
import { createClient } from "@/lib/supabase/server";

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

  const { data: closure } = await supabase
    .from("cash_daily_closures")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("closure_date", date)
    .maybeSingle();

  let totals: Record<string, number> = (closure?.totals as Record<string, number>) ?? {};
  let patientCount = closure?.patient_count ?? 0;
  let consultationCount = closure?.consultation_count ?? 0;

  if (!closure) {
    const dayStart = startOfDay(new Date()).toISOString();
    const dayEnd = endOfDay(new Date()).toISOString();
    const { data: charges } = await supabase
      .from("cash_charges")
      .select("amount, payment_method, attention_type, charge_kind, patient_id")
      .eq("clinic_id", clinicId)
      .eq("status", "collected")
      .gte("charged_at", dayStart)
      .lte("charged_at", dayEnd);

    totals = { general: 0, particular: 0, copago: 0, coseguro: 0, art: 0, obra_social: 0 };
    for (const m of ["cash", "debit", "credit", "transfer", "mercadopago", "qr", "account"]) {
      totals[m] = 0;
    }
    const patients = new Set<string>();
    for (const c of charges ?? []) {
      patients.add(c.patient_id);
      const amt = Number(c.amount);
      totals.general += amt;
      if (c.payment_method in totals) totals[c.payment_method] += amt;
      if (c.charge_kind === "consulta_particular") totals.particular += amt;
      if (c.charge_kind === "copago_autorizado") totals.copago += amt;
      if (c.charge_kind === "coseguro_autorizado") totals.coseguro += amt;
      if (c.attention_type === "art") totals.art += amt;
      if (c.attention_type === "obra_social") totals.obra_social += amt;
    }
    patientCount = patients.size;
    consultationCount = charges?.length ?? 0;
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
