import { redirect } from "next/navigation";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { PagosView } from "@/features/facturacion/components/pagos/pagos-view";

import { loadPatientPickerList } from "@/lib/server/load-patient-picker-list";

export default async function PagosPage() {
  const { profile, clinics, clinicId, role, isSuperadmin } = await getDashboardPageContext();

  if (!hasPermission(role, "managePayments", isSuperadmin)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const [payments, patientPicker] = clinicId
    ? await Promise.all([
        supabase
          .from("payments")
          .select("id, clinic_id, patient_id, amount, deposit_amount, status, created_at, patients(first_name, last_name)")
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false })
          .limit(50),
        loadPatientPickerList(supabase, clinicId),
      ])
    : [{ data: [] }, { patients: [] }];

  return (
    <PagosView
      payments={(payments.data ?? []) as never}
      patients={patientPicker.patients as never}
      clinics={clinics}
      clinicId={clinicId}
      role={role}
      userName={profile?.full_name}
    />
  );
}
