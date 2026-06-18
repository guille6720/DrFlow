import { PagosView } from "@/components/pagos/pagos-view";
import {
  getActiveClinicId,
  getProfile,
  getUserClinics,
  getActiveClinic,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions/roles";

export default async function PagosPage() {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!hasPermission(role, "managePayments", isSuperadmin)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const [payments, patients] = clinicId
    ? await Promise.all([
        supabase
          .from("payments")
          .select("*, patients(first_name, last_name)")
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("patients").select("*").eq("clinic_id", clinicId).eq("is_active", true),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <PagosView
      payments={payments.data ?? []}
      patients={patients.data ?? []}
      clinics={clinics}
      clinicId={clinicId}
      role={role}
      userName={profile?.full_name}
    />
  );
}
