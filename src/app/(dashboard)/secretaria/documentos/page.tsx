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

import { AdminDocumentsPanel } from "@/features/administracion/components/secretaria/admin-documents-panel";

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
