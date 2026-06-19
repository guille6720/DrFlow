import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PrescriptionPanel } from "@/components/recetas/prescription-panel";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/roles";
import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import { PamiPatientBanner } from "@/components/pacientes/pami-patient-banner";
import { PatientAppShareControl } from "@/components/pacientes/patient-app-share-control";
import { getDoctorShareInfoForClinic, getPortalSlugForClinic } from "@/lib/utils/portal-doctor-info";
import { PatientWhatsAppButton } from "@/components/ui/patient-whatsapp-button";
import { buildPatientContactMessage } from "@/lib/utils/patient-messages";
import { ExportClinicalPdfButton } from "@/components/historias/export-pdf-button";
import { MedicalOrderPanel } from "@/components/historias/medical-order-panel";
import { ConsultationTimer } from "@/components/historias/consultation-timer";
import { FinalizeConsultationButton } from "@/components/historias/finalize-consultation-button";
import { ClinicalDocumentsPanel } from "@/components/historias/clinical-documents-panel";

export default async function HistoriaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin, clinic } = await getActiveClinic();
  const supabase = await createClient();

  if (!clinicId) notFound();

  const { data: record } = await supabase
    .from("clinical_records")
    .select("*, patients(id, first_name, last_name, document_number, birth_date, insurance_provider, insurance_number, phone, email, allergies, regular_medication, emergency_contact_name, emergency_contact_phone), professionals(profiles(full_name))")
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .single();

  if (!record) notFound();

  const patient = record.patients as unknown as {
    id: string;
    first_name: string;
    last_name: string;
    document_number: string;
    birth_date: string | null;
    insurance_provider: string | null;
    insurance_number: string | null;
    phone: string | null;
    email: string | null;
    allergies: string | null;
    regular_medication: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
  };

  const portalSlug = await getPortalSlugForClinic(clinicId);
  const doctorInfo = portalSlug ? await getDoctorShareInfoForClinic(clinicId) : null;

  const [{ data: audit }, { data: prescriptions }, { data: professionals }, { data: medicalOrders }, { data: appShare }, { data: clinicalDocuments }] =
    await Promise.all([
    supabase
      .from("clinical_record_audit")
      .select("*, profiles:changed_by(full_name)")
      .eq("clinical_record_id", id)
      .order("changed_at", { ascending: false }),
    supabase
      .from("prescription_drafts")
      .select("*")
      .eq("clinical_record_id", id)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false }),
    supabase
      .from("professionals")
      .select("id, display_name, license_number, profiles(full_name), specialties(name)")
      .eq("clinic_id", clinicId)
      .eq("is_active", true),
    supabase
      .from("medical_orders")
      .select("*")
      .eq("clinical_record_id", id)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false }),
    portalSlug
      ? supabase
          .from("patient_app_share_log")
          .select("shared_at, channel, profiles(full_name)")
          .eq("patient_id", patient.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("patient_attachments")
      .select("id, file_name, file_size, category, created_at, profiles:uploaded_by(full_name)")
      .eq("patient_id", patient.id)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false }),
  ]);

  const shareProfile = appShare?.profiles as { full_name?: string } | null;
  const patientShare = appShare
    ? {
        sharedAt: appShare.shared_at,
        sharedByName: shareProfile?.full_name ?? null,
        channel: appShare.channel,
      }
    : null;
  const professional = record.professionals as unknown as { profiles: { full_name: string } | null };
  const canIssue = hasPermission(role, "issuePrescriptions", isSuperadmin);
  const canEditClinical = hasPermission(role, "editClinicalRecords", isSuperadmin);
  const canViewClinical = hasPermission(role, "viewClinicalRecords", isSuperadmin);
  const professionalList = (professionals ?? []) as unknown as Array<{
    id: string;
    display_name?: string | null;
    license_number?: string | null;
    profiles?: { full_name: string } | null;
    specialties?: { name: string } | { name: string }[] | null;
  }>;

  return (
    <>
      <Header
        title="Detalle de consulta"
        subtitle={`${patient.last_name}, ${patient.first_name}`}
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />

      <div className="space-y-6 p-4 sm:p-6">
        <PamiPatientBanner patient={patient} />

        {portalSlug && doctorInfo && (
          <Card title="App para el paciente">
            <PatientAppShareControl
              patientId={patient.id}
              patientName={`${patient.first_name} ${patient.last_name}`}
              patientPhone={patient.phone}
              slug={portalSlug}
              doctor={doctorInfo}
              share={patientShare}
            />
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/historias" className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
          {record.appointment_id && (
            <ConsultationTimer storageKey={record.appointment_id} />
          )}
          <ExportClinicalPdfButton record={record} patient={patient} professional={professional} />
          <PatientWhatsAppButton
            phone={patient.phone}
            message={buildPatientContactMessage(
              `${patient.first_name} ${patient.last_name}`,
              professional?.profiles?.full_name ?? profile?.full_name ?? undefined
            )}
            label="WhatsApp paciente"
            size="md"
          />
          <Link href={`/historias/${id}/editar`}>
            <Button variant="outline" size="sm">Editar consulta</Button>
          </Link>
          {record.appointment_id && hasPermission(role, "editClinicalRecords", isSuperadmin) && (
            <FinalizeConsultationButton appointmentId={record.appointment_id} />
          )}
          {canIssue && (
            <Link href="/recetas">
              <Button variant="outline" size="sm">Ver todas las recetas</Button>
            </Link>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Consulta">
            <dl className="space-y-4 text-sm">
              <div><dt className="font-medium text-slate-500">Fecha</dt><dd>{format(new Date(record.created_at), "PPp", { locale: es })}</dd></div>
              <div><dt className="font-medium text-slate-500">Profesional</dt><dd>{professional?.profiles?.full_name ?? "—"}</dd></div>
              <div><dt className="font-medium text-slate-500">Motivo</dt><dd className="whitespace-pre-wrap">{record.chief_complaint ?? "—"}</dd></div>
              <div><dt className="font-medium text-slate-500">Diagnóstico</dt><dd className="whitespace-pre-wrap">{record.diagnosis ?? "—"}</dd></div>
              <div><dt className="font-medium text-slate-500">Evolución</dt><dd className="whitespace-pre-wrap">{record.evolution ?? "—"}</dd></div>
              <div><dt className="font-medium text-slate-500">Indicaciones</dt><dd className="whitespace-pre-wrap">{record.indications ?? "—"}</dd></div>
              {record.professional_signature && (
                <div><dt className="font-medium text-slate-500">Firma</dt><dd>{record.professional_signature}</dd></div>
              )}
            </dl>
          </Card>

          <div className="space-y-6">
            {canViewClinical && (
              <ClinicalDocumentsPanel
                patientId={patient.id}
                documents={clinicalDocuments ?? []}
                canEdit={canEditClinical}
              />
            )}

            <Card title="Auditoría">
              {(audit ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">Sin eventos de auditoría.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {(audit ?? []).map((a) => (
                    <li key={a.id} className="rounded-lg bg-slate-50 p-3">
                      <p className="font-medium capitalize">{a.action}</p>
                      <p className="text-slate-500">
                        {(a.profiles as { full_name: string } | null)?.full_name ?? "Usuario"}
                        {" · "}
                        {format(new Date(a.changed_at), "PPp", { locale: es })}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {canIssue && clinic && (
              <>
                <PrescriptionPanel
                  prescriptions={prescriptions ?? []}
                  patient={patient}
                  clinicalRecordId={id}
                  diagnosis={record.diagnosis}
                  professionals={professionalList}
                  clinic={{
                    name: clinic.name,
                    address: clinic.address,
                    phone: clinic.phone,
                  }}
                  canIssue={canIssue}
                />
                <MedicalOrderPanel
                  orders={medicalOrders ?? []}
                  patientId={patient.id}
                  clinicalRecordId={id}
                  professionals={professionalList}
                  defaultProfessionalId={record.professional_id}
                  canIssue={canIssue}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
