import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PamiPatientBanner } from "@/components/pacientes/pami-patient-banner";
import { PatientAppShareControl } from "@/components/pacientes/patient-app-share-control";
import { getPortalSlugForClinic } from "@/lib/actions/patient-app-share";
import { formatAgeLabel } from "@/lib/utils/patient-age";
import { Badge, appointmentStatusBadge } from "@/components/ui/badge";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";

export default async function PacienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, clinic } = await getActiveClinic();
  const supabase = await createClient();

  if (!clinicId) notFound();

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .single();

  if (!patient) notFound();

  const portalSlug = clinicId ? await getPortalSlugForClinic(clinicId) : null;

  const [{ data: appointments }, { data: records }, { data: appShare }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, start_at, status, professionals(profiles(full_name))")
      .eq("patient_id", id)
      .order("start_at", { ascending: false })
      .limit(10),
    supabase
      .from("clinical_records")
      .select("id, diagnosis, created_at, professionals(profiles(full_name))")
      .eq("patient_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    portalSlug
      ? supabase
          .from("patient_app_share_log")
          .select("shared_at, channel, profiles(full_name)")
          .eq("patient_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const shareProfile = appShare?.profiles as { full_name?: string } | null;
  const patientShare = appShare
    ? {
        sharedAt: appShare.shared_at,
        sharedByName: shareProfile?.full_name ?? null,
        channel: appShare.channel,
      }
    : null;

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

      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/pacientes" className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline">
            <ArrowLeft className="h-4 w-4" /> Volver al listado
          </Link>
          <Link href={`/pacientes/${id}/editar`}>
            <Button variant="outline" size="sm">Editar ficha</Button>
          </Link>
        </div>

        <PamiPatientBanner patient={patient} />

        {portalSlug && clinic && (
          <Card title="App para el paciente">
            <PatientAppShareControl
              patientId={patient.id}
              patientName={`${patient.first_name} ${patient.last_name}`}
              patientPhone={patient.phone}
              slug={portalSlug}
              clinicName={clinic.name}
              share={patientShare}
            />
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Datos personales">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">Teléfono</dt><dd>{patient.phone ?? "—"}</dd></div>
              <div><dt className="text-slate-500">Email</dt><dd>{patient.email ?? "—"}</dd></div>
              <div><dt className="text-slate-500">Dirección</dt><dd>{patient.address ?? "—"}</dd></div>
              <div><dt className="text-slate-500">Obra social</dt><dd className="flex items-center gap-2">{patient.insurance_provider ?? "—"}{patient.insurance_provider?.toUpperCase().includes("PAMI") && <Badge variant="teal">PAMI</Badge>}</dd></div>
              <div><dt className="text-slate-500">N° afiliado</dt><dd>{patient.insurance_number ?? "—"}</dd></div>
              <div><dt className="text-slate-500">Emergencia</dt><dd>{patient.emergency_contact_name ?? "—"} {patient.emergency_contact_phone && `(${patient.emergency_contact_phone})`}</dd></div>
            </dl>
          </Card>

          <Card title="Información clínica">
            <dl className="space-y-3 text-sm">
              <div><dt className="text-slate-500">Antecedentes</dt><dd>{patient.medical_history ?? "Sin registrar"}</dd></div>
              <div><dt className="text-slate-500">Alergias</dt><dd className="text-red-700">{patient.allergies ?? "Sin registrar"}</dd></div>
              <div><dt className="text-slate-500">Medicación habitual</dt><dd>{patient.regular_medication ?? "Sin registrar"}</dd></div>
            </dl>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Historial de turnos">
            {(appointments ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">Sin turnos registrados.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {(appointments ?? []).map((a) => {
                  const statusInfo = appointmentStatusBadge[a.status as string];
                  return (
                    <li key={a.id} className="flex justify-between py-2">
                      <div>
                        <p>{format(new Date(a.start_at), "PPp", { locale: es })}</p>
                        <p className="text-slate-500">
                          {(a.professionals as unknown as { profiles?: { full_name?: string } })?.profiles?.full_name}
                        </p>
                      </div>
                      {statusInfo && <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Consultas clínicas">
            {(records ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">Sin consultas registradas.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {(records ?? []).map((r) => (
                  <li key={r.id} className="py-2">
                    <Link href={`/historias/${r.id}`} className="text-blue-700 hover:underline">
                      {format(new Date(r.created_at), "PP", { locale: es })}
                    </Link>
                    <p className="text-slate-600">{r.diagnosis ?? "Sin diagnóstico"}</p>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/historias/nueva?patient=${id}`} className="mt-4 inline-block text-sm text-blue-700 hover:underline">
              + Nueva consulta
            </Link>
          </Card>
        </div>
      </div>
    </>
  );
}
