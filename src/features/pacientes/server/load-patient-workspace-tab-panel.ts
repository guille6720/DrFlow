"use server";

import { getActiveClinic, getActiveClinicId, getSession } from "@/core/auth/session.server";
import { hasPermission } from "@/core/permissions/roles";
import { PATIENT_DETAIL_COLUMNS } from "@/core/supabase/select-columns";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

import type { PatientWorkspaceTabId } from "@/features/pacientes/constants/patient-workspace-tabs";
import { loadPatientAuditTrail } from "@/features/pacientes/server/load-patient-audit-trail";
import {
  loadPatientWorkspacePageData,
  type PatientWorkspacePagePayload,
} from "@/features/pacientes/server/load-patient-workspace-page";

export type PatientWorkspaceAdminDocumentRow = {
  id: string;
  title: string;
  file_name: string;
  category: string;
  created_at: string;
};

export type PatientWorkspaceTabPanelResult = {
  workspace?: PatientWorkspacePagePayload;
  adminDocuments?: PatientWorkspaceAdminDocumentRow[];
  auditTrail?: Awaited<ReturnType<typeof loadPatientAuditTrail>> | null;
  error?: string;
};

/** Lazy-loads tab-scoped workspace data without a full RSC navigation. */
export async function loadPatientWorkspaceTabPanel(
  patientId: string,
  tab: PatientWorkspaceTabId
): Promise<PatientWorkspaceTabPanelResult> {
  const user = await getSession();
  if (!user) return { error: "Sin sesión" };

  const clinicId = await getActiveClinicId();
  if (!clinicId) return { error: "Sin clínica activa" };

  const { role, isSuperadmin } = await getActiveClinic();
  if (!hasPermission(role, "viewClinicalRecords", isSuperadmin)) {
    return { error: "Sin permisos para ver historias clínicas" };
  }

  const parsedPatientId = parseEntityId(patientId, "Paciente");
  if (!parsedPatientId.ok) return { error: parsedPatientId.error };

  const supabase = await createClient();
  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select(PATIENT_DETAIL_COLUMNS)
    .eq("id", parsedPatientId.data)
    .eq("clinic_id", clinicId)
    .single();

  if (patientError || !patient) return { error: "Paciente no encontrado" };

  const canManageAdminDocuments = hasPermission(role, "manageAdminDocuments", isSuperadmin);

  const [workspace, auditTrail, adminDocumentsResult] = await Promise.all([
    loadPatientWorkspacePageData(supabase, clinicId, patient, tab),
    tab === "auditoria" ? loadPatientAuditTrail(parsedPatientId.data) : Promise.resolve(null),
    tab === "docs_admin" && canManageAdminDocuments
      ? supabase
          .from("patient_admin_documents")
          .select("id, title, file_name, category, created_at")
          .eq("clinic_id", clinicId)
          .eq("patient_id", parsedPatientId.data)
          .order("created_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
  ]);

  return {
    workspace,
    adminDocuments: adminDocumentsResult.data ?? [],
    auditTrail,
  };
}
