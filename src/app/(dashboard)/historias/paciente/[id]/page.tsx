import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { PatientEhrView } from "@/components/historias/patient-ehr-view";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatAgeLabel } from "@/lib/utils/patient-age";
import { buildEhrPayloadFromRecords } from "@/lib/utils/patient-ehr-model";
import { ArrowLeft, Plus } from "lucide-react";

const RECORD_LIMIT = 2000;

export default async function PatientClinicalHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: patientId } = await params;

  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role } = await getActiveClinic();
  const supabase = await createClient();

  if (!clinicId) notFound();

  const { data: patient } = await supabase
    .from("patients")
    .select(
      "id, first_name, last_name, document_number, phone, birth_date, insurance_provider, insurance_number"
    )
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!patient) notFound();

  const { count: totalRecords } = await supabase
    .from("clinical_records")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId);

  const { data: records } = await supabase
    .from("clinical_records")
    .select(
      "id, created_at, chief_complaint, diagnosis, evolution, indications, professionals(profiles(full_name))"
    )
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: true })
    .limit(RECORD_LIMIT);

  const [{ data: attachments }, { data: rxList }] = await Promise.all([
    supabase
      .from("patient_attachments")
      .select("id, file_name, created_at, category")
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false }),
    supabase
      .from("prescription_drafts")
      .select("id, created_at, medications, status")
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const mappedRecords =
    records?.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      chief_complaint: r.chief_complaint,
      diagnosis: r.diagnosis,
      evolution: r.evolution,
      indications: r.indications,
      professional_name:
        (r.professionals as { profiles?: { full_name?: string } } | null)?.profiles?.full_name ??
        "Profesional",
    })) ?? [];

  const { consultations, diagnosisRows, treatmentRows } =
    buildEhrPayloadFromRecords(mappedRecords);

  const prescriptions =
    rxList?.map((rx) => {
      const meds = rx.medications as unknown;
      let label = "Receta";
      if (Array.isArray(meds) && meds.length > 0) {
        const first = meds[0] as { name?: string };
        label = first.name ? `Receta · ${first.name}${meds.length > 1 ? ` +${meds.length - 1}` : ""}` : "Receta";
      }
      return {
        id: rx.id,
        created_at: rx.created_at,
        label,
      };
    }) ?? [];

  const patientName = `${patient.last_name}, ${patient.first_name}`;

  return (
    <>
      <Header
        title="Historia clínica electrónica"
        subtitle={patientName}
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />

      <div className="border-b border-slate-200 bg-white px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/historias"
            className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
          <Link href={`/pacientes/${patientId}`}>
            <Button variant="outline" size="sm">
              Ficha del paciente
            </Button>
          </Link>
          <Link href={`/historias/nueva?patient=${patientId}`}>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Nueva consulta
            </Button>
          </Link>
        </div>
      </div>

      {(totalRecords ?? 0) === 0 ? (
        <div className="p-8 text-center">
          <p className="text-slate-600">Este paciente aún no tiene consultas registradas.</p>
          <Link href={`/historias/nueva?patient=${patientId}`} className="mt-4 inline-block">
            <Button>Registrar primera consulta</Button>
          </Link>
        </div>
      ) : (
        <PatientEhrView
          patient={{
            id: patient.id,
            first_name: patient.first_name,
            last_name: patient.last_name,
            document_number: patient.document_number,
            birth_date: patient.birth_date,
            age_label: formatAgeLabel(patient.birth_date),
            insurance_provider: patient.insurance_provider,
            insurance_number: patient.insurance_number,
            phone: patient.phone,
          }}
          consultations={consultations}
          diagnosisRows={diagnosisRows}
          treatmentRows={treatmentRows}
          attachments={
            attachments?.map((a) => ({
              id: a.id,
              file_name: a.file_name,
              created_at: a.created_at,
              category: a.category,
            })) ?? []
          }
          prescriptions={prescriptions}
          totalConsultations={totalRecords ?? consultations.length}
        />
      )}
    </>
  );
}
