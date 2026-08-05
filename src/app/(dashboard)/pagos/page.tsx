import { PagosView } from "@/features/facturacion/components/pagos/pagos-view";
import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { createClient } from "@/core/supabase/server";
import { PATIENT_PICKER_COLUMNS } from "@/core/supabase/select-columns";
import { redirect } from "next/navigation";
import { hasPermission } from "@/core/permissions/roles";

export default async function PagosPage() {
  const { profile, clinics, clinicId, role, isSuperadmin } = await getDashboardPageContext();

  if (!hasPermission(role, "managePayments", isSuperadmin)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const [payments, patients] = clinicId
    ? await Promise.all([
        supabase
          .from("payments")
          .select("id, clinic_id, patient_id, amount, deposit_amount, status, created_at, patients(first_name, last_name)")
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("patients")
          .select(PATIENT_PICKER_COLUMNS)
          .eq("clinic_id", clinicId)
          .eq("is_active", true)
          .order("last_name")
          .limit(500),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <PagosView
      payments={(payments.data ?? []) as never}
      patients={(patients.data ?? []) as never}
      clinics={clinics}
      clinicId={clinicId}
      role={role}
      userName={profile?.full_name}
    />
  );
}
