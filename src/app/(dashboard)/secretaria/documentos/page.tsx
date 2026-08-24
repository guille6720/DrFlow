import { redirect } from "next/navigation";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { hasPermission } from "@/core/permissions/roles";
import { PATIENT_ADMIN_COLUMNS } from "@/core/supabase/select-columns";
import { createClient } from "@/core/supabase/server";

import { AdminDocumentsPanel } from "@/features/administracion/components/secretaria/admin-documents-panel";
import { PatientAdminDetailView } from "@/features/pacientes/components/pacientes/patient-admin-detail-view";
import { patientWorkspacePath } from "@/features/pacientes/constants/patient-workspace-tabs";

export default async function SecretariaDocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>;
}) {
  const { patient: patientIdParam } = await searchParams;
  const { clinicId, role, isSuperadmin } = await getDashboardPageContext();

  if (!hasPermission(role, "manageAdminDocuments", isSuperadmin) || !clinicId) {
    redirect("/dashboard");
  }

  const canViewClinical = hasPermission(role, "viewClinicalRecords", isSuperadmin);

  if (patientIdParam && canViewClinical) {
    redirect(patientWorkspacePath(patientIdParam, "docs_admin"));
  }

  if (patientIdParam) {
    const supabase = await createClient();
    const [{ data: patient }, { data: documents }] = await Promise.all([
      supabase
        .from("patients")
        .select(PATIENT_ADMIN_COLUMNS)
        .eq("id", patientIdParam)
        .eq("clinic_id", clinicId)
        .single(),
      supabase
        .from("patient_admin_documents")
        .select("id, title, file_name, category, created_at")
        .eq("clinic_id", clinicId)
        .eq("patient_id", patientIdParam)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (!patient) redirect("/pacientes");

    return (
      <div className="p-4 sm:p-6">
        <PatientAdminDetailView patient={patient} />
        <div className="mt-4">
          <AdminDocumentsPanel
            patientId={patient.id}
            patientLabel={`${patient.last_name}, ${patient.first_name} — ${patient.document_number}`}
            documents={documents ?? []}
          />
        </div>
      </div>
    );
  }

  redirect("/pacientes");
}
