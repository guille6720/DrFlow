import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { DeletePatientButton } from "@/components/pacientes/delete-patient-button";
import { PatientChartView } from "@/components/pacientes/patient-chart-view";
import { PatientArcoExportButton } from "@/components/legal/patient-arco-export-button";
import { getDoctorShareInfoForClinic, getPortalSlugForClinic } from "@/lib/utils/portal-doctor-info";
import { formatAgeLabel } from "@/lib/utils/patient-age";
import { buildPatientChartPayload } from "@/lib/utils/patient-chart-model";
import { hasPermission } from "@/lib/permissions/roles";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import type { PrescriptionMedication } from "@/types/prescription";

export default async function PacienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
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

  const portalSlug = clinicId ? await getPortalSlugForClinic(clinicId) : null;
  const doctorInfo =
    clinicId && portalSlug ? await getDoctorShareInfoForClinic(clinicId) : null;

  const [
    { data: appointments },
    { data: records },
    { data: appShare },
    { data: clinicalDocuments },
    { data: prescriptions },
    { data: professionals },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, start_at, status, cancellation_reason, cancelled_by_type, professionals(profiles(full_name))")
      .eq("patient_id", id)
      .order("start_at", { ascending: false })
      .limit(10),
    canViewClinical
      ? supabase
          .from("clinical_records")
          .select(
            "id, diagnosis, chief_complaint, evolution, indications, created_at, professionals(profiles(full_name))"
          )
          .eq("patient_id", id)
          .order("created_at", { ascending: false })
          .limit(15)
      : Promise.resolve({ data: [] as never[] }),
    portalSlug
      ? supabase
          .from("patient_app_share_log")
          .select("shared_at, channel, profiles(full_name)")
          .eq("patient_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    canViewClinical
      ? supabase
          .from("patient_attachments")
          .select("id, file_name, file_size, category, created_at, profiles:uploaded_by(full_name)")
          .eq("patient_id", id)
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("prescription_drafts")
      .select("id, medications, issued_at, created_at")
      .eq("patient_id", id)
      .eq("clinic_id", clinicId)
      .eq("status", "issued")
      .order("issued_at", { ascending: false })
      .limit(5),
    supabase
      .from("professionals")
      .select("id, display_name, license_number, profiles(full_name)")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("display_name"),
  ]);

  const lastRx = prescriptions?.[0];
  const lastMedications = (lastRx?.medications as PrescriptionMedication[] | null) ?? null;

  const shareProfile = appShare?.profiles as { full_name?: string } | null;
  const patientShare = appShare
    ? {
        sharedAt: appShare.shared_at,
        sharedByName: shareProfile?.full_name ?? null,
        channel: appShare.channel,
      }
    : null;

  const mappedRecords = (records ?? []).map((r) => {
    const pro = r.professionals as unknown as { profiles?: { full_name?: string } } | null;
    return {
      id: r.id,
      created_at: r.created_at,
      chief_complaint: r.chief_complaint,
      diagnosis: r.diagnosis,
      evolution: r.evolution,
      indications: r.indications,
      professional_name: pro?.profiles?.full_name ?? "Profesional",
    };
  });

  const mappedAttachments = (clinicalDocuments ?? []).map((d) => ({
    id: d.id,
    file_name: d.file_name,
    category: d.category,
    created_at: d.created_at,
    uploaded_by: null as string | null,
  }));

  const chart = buildPatientChartPayload({
    patient: {
      birth_date: patient.birth_date,
      insurance_provider: patient.insurance_provider,
      medical_history: patient.medical_history,
      allergies: patient.allergies,
      regular_medication: patient.regular_medication,
      notes: patient.notes,
    },
    records: mappedRecords,
    prescriptions: (prescriptions ?? []).map((p) => ({
      id: p.id,
      created_at: p.issued_at ?? p.created_at,
      medications: p.medications,
    })),
    attachments: mappedAttachments,
  });

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
          <Link href="/pacientes" className="drflow-link inline-flex items-center gap-1 text-sm">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
          {canManagePatients && (
            <DeletePatientButton
              patientId={patient.id}
              patientName={`${patient.last_name}, ${patient.first_name}`}
            />
          )}
        </div>

        <PatientChartView
          patient={patient}
          patientId={id}
          chart={chart}
          canEditClinical={canEditClinical}
          canIssue={canIssue}
          professionals={(professionals ?? []).map((p) => ({
            id: p.id,
            display_name: p.display_name,
            license_number: p.license_number,
            profiles: Array.isArray(p.profiles)
              ? (p.profiles[0] as { full_name: string } | undefined) ?? null
              : (p.profiles as { full_name: string } | null),
          }))}
          lastMedications={lastMedications}
          regularMedication={patient.regular_medication}
          clinicalDocuments={clinicalDocuments ?? []}
          appointments={(appointments ?? []) as import("@/components/pacientes/patient-chart-view").AppointmentRow[]}
          portalSlug={portalSlug}
          doctorInfo={doctorInfo}
          patientShare={patientShare}
          arcoExport={
            canManagePatients ? (
              <PatientArcoExportButton
                patientId={patient.id}
                fileLabel={`${patient.document_number}`}
              />
            ) : undefined
          }
        />
      </div>
    </>
  );
}
