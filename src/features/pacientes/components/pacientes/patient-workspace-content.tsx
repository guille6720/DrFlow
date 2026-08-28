import { PatientArcoExportButton } from "@/core/components/legal/patient-arco-export-button";
import { voidRecordSensitiveAccess } from "@/core/security/sensitive-access-audit";
import { createClient } from "@/core/supabase/server";

import type { PatientChartPatient } from "@/features/pacientes/components/pacientes/patient-chart-view-types";
import { PatientWorkspaceShell } from "@/features/pacientes/components/pacientes/patient-workspace-shell";
import type { PatientWorkspaceTabId } from "@/features/pacientes/constants/patient-workspace-tabs";
import { loadPatientAuditTrail } from "@/features/pacientes/server/load-patient-audit-trail";
import { loadPatientWorkspacePageData } from "@/features/pacientes/server/load-patient-workspace-page";

type Props = {
  clinicId: string;
  clinic: {
    name: string;
    address?: string | null;
    phone?: string | null;
    refepsEnabled?: boolean;
  };
  patient: PatientChartPatient & {
    medical_history: string | null;
    allergies: string | null;
    regular_medication: string | null;
    notes: string | null;
  };
  patientRecord: import("@/types/database").Patient;
  patientId: string;
  initialTab: PatientWorkspaceTabId;
  canEditClinical: boolean;
  canIssue: boolean;
  canManagePatients: boolean;
  canManageAdminDocuments: boolean;
};

export async function PatientWorkspaceContent({
  clinicId,
  clinic,
  patient,
  patientRecord,
  patientId,
  initialTab,
  canEditClinical,
  canIssue,
  canManagePatients,
  canManageAdminDocuments,
}: Props) {
  const supabase = await createClient();
  const [workspace, auditTrail] = await Promise.all([
    loadPatientWorkspacePageData(supabase, clinicId, patient, initialTab),
    initialTab === "auditoria" ? loadPatientAuditTrail(patientId) : Promise.resolve(null),
  ]);

  const adminDocuments =
    initialTab === "docs_admin" && canManageAdminDocuments
      ? (
          await supabase
            .from("patient_admin_documents")
            .select("id, title, file_name, category, created_at")
            .eq("clinic_id", clinicId)
            .eq("patient_id", patientId)
            .order("created_at", { ascending: false })
            .limit(50)
        ).data ?? []
      : [];

  if (initialTab === "docs_admin" && canManageAdminDocuments) {
    voidRecordSensitiveAccess({
      clinicId,
      patientId,
      kind: "patient_admin_documents",
    });
  }

  return (
    <>
      {canManagePatients ? (
        <div className="mb-3 flex justify-end">
          <PatientArcoExportButton patientId={patient.id} fileLabel={`${patient.document_number}`} />
        </div>
      ) : null}
      <PatientWorkspaceShell
        key={patientId}
        clinicId={clinicId}
        clinic={clinic}
        patient={patient}
        patientRecord={patientRecord}
        patientId={patientId}
        initialTab={initialTab}
        initialWorkspace={workspace}
        initialAdminDocuments={adminDocuments}
        initialAuditTrail={
          auditTrail
            ? {
                data: auditTrail.data,
                error: auditTrail.error ?? null,
                nextCursor: auditTrail.nextCursor ?? null,
                hasMore: auditTrail.hasMore ?? false,
              }
            : null
        }
        canEditClinical={canEditClinical}
        canIssue={canIssue}
        canManageAdminDocuments={canManageAdminDocuments}
      />
    </>
  );
}
