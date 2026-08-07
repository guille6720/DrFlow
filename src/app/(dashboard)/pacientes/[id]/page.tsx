import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/core/auth/session";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { PatientWorkspaceContent } from "@/features/pacientes";
import { PatientWorkspaceSkeleton } from "@/features/pacientes";
import { DeletePatientButton } from "@/features/pacientes/components/pacientes/delete-patient-button";
import { PatientAdminDetailView } from "@/features/pacientes/components/pacientes/patient-admin-detail-view";
import { PatientWorkspaceBackLink } from "@/features/pacientes/components/pacientes/patient-workspace-back-link";
import {
  DEFAULT_HC_WORKSPACE_TAB,
  LEGACY_TAB_ALIASES,
  parsePatientWorkspaceTab,
} from "@/features/pacientes/constants/patient-workspace-tabs";
import { formatAgeLabel } from "@/features/pacientes/utils/patient-age";

export default async function PacienteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; patient?: string; tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { from, patient: returnPatientId, tab: tabParam } = sp;
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin, clinic } = await getActiveClinic();
  const supabase = await createClient();

  if (!clinicId) notFound();

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .single();

  if (!patient) notFound();

  const canManagePatients = hasPermission(role, "managePatients", isSuperadmin);
  const canEditClinical = hasPermission(role, "editClinicalRecords", isSuperadmin);
  const canViewClinical = hasPermission(role, "viewClinicalRecords", isSuperadmin);
  const canIssue = hasPermission(role, "issuePrescriptions", isSuperadmin);
  const canManageAdminDocuments = hasPermission(role, "manageAdminDocuments", isSuperadmin);

  const initialTabRaw = parsePatientWorkspaceTab(
    tabParam ? (LEGACY_TAB_ALIASES[tabParam] ?? tabParam) : null
  );
  const initialTab =
    initialTabRaw === "docs_admin" && !canManageAdminDocuments
      ? DEFAULT_HC_WORKSPACE_TAB
      : initialTabRaw;

  return (
    <>
      <Header
        title={`${patient.last_name}, ${patient.first_name}`}
        subtitle={`DNI ${patient.document_number}${formatAgeLabel(patient.birth_date) ? ` · ${formatAgeLabel(patient.birth_date)}` : ""}`}
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Suspense fallback={null}>
            <PatientWorkspaceBackLink
              patientId={id}
              initialFrom={from}
              returnPatientId={returnPatientId}
            />
          </Suspense>
          {canManagePatients && (
            <DeletePatientButton
              patientId={patient.id}
              patientName={`${patient.last_name}, ${patient.first_name}`}
            />
          )}
        </div>

        {!canViewClinical ? (
          <PatientAdminDetailView patient={patient} />
        ) : (
          <Suspense fallback={<PatientWorkspaceSkeleton />}>
            <PatientWorkspaceContent
              clinicId={clinicId}
              clinic={{
                name: clinic?.name ?? "Consultorio",
                address: clinic?.address ?? null,
                phone: clinic?.phone ?? null,
              }}
              patient={patient}
              patientRecord={patient}
              patientId={id}
              initialTab={initialTab}
              canEditClinical={canEditClinical}
              canIssue={canIssue}
              canManagePatients={canManagePatients}
              canManageAdminDocuments={canManageAdminDocuments}
            />
          </Suspense>
        )}
      </div>
    </>
  );
}
