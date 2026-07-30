import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { AdminDocumentsPanel } from "@/components/secretaria/admin-documents-panel";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/roles";
import { createClient } from "@/lib/supabase/server";

export default async function SecretariaDocumentosPage() {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!hasPermission(role, "manageAdminDocuments", isSuperadmin) || !clinicId) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const [{ data: documents }, { data: patients }] = await Promise.all([
    supabase
      .from("patient_admin_documents")
      .select("id, title, file_name, category, created_at, patients(first_name, last_name)")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("patients")
      .select("id, first_name, last_name, document_number")
      .eq("clinic_id", clinicId)
      .order("last_name")
      .limit(300),
  ]);

  return (
    <>
      <Header
        title="Documentación administrativa"
        subtitle="Secretaría"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />
      <div className="p-4 sm:p-6">
        <AdminDocumentsPanel
          documents={(documents ?? []).map((d) => ({
            ...d,
            patients: Array.isArray(d.patients) ? d.patients[0] ?? null : d.patients,
          }))}
          patients={(patients ?? []).map((p) => ({
            id: p.id,
            label: `${p.last_name}, ${p.first_name} — ${p.document_number}`,
          }))}
          showPatientPicker
        />
      </div>
    </>
  );
}
