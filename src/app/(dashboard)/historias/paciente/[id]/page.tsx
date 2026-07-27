import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { PatientWhatsAppButton } from "@/components/ui/patient-whatsapp-button";
import { buildPatientContactMessage } from "@/lib/utils/patient-messages";

const PAGE_SIZE = 40;

export default async function PatientClinicalHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id: patientId } = await params;
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);

  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role } = await getActiveClinic();
  const supabase = await createClient();

  if (!clinicId) notFound();

  const { data: patient } = await supabase
    .from("patients")
    .select("id, first_name, last_name, document_number, phone, birth_date")
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!patient) notFound();

  const { count: totalRecords } = await supabase
    .from("clinical_records")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId);

  const total = totalRecords ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const from = (safePage - 1) * PAGE_SIZE;

  const { data: records } = await supabase
    .from("clinical_records")
    .select(
      "id, created_at, chief_complaint, diagnosis, evolution, indications, professionals(profiles(full_name))"
    )
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  const { count: clinicTotal } = await supabase
    .from("clinical_records")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId);

  const pageQuery = (p: number) =>
    p <= 1 ? `/historias/paciente/${patientId}` : `/historias/paciente/${patientId}?page=${p}`;

  const patientName = `${patient.last_name}, ${patient.first_name}`;

  return (
    <>
      <Header
        title="Historia clínica completa"
        subtitle={patientName}
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />

      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/historias"
            className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al listado
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

        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{patientName}</h1>
          <p className="mt-1 text-slate-600">DNI {patient.document_number}</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <p>
              <span className="font-semibold text-slate-900">{total}</span>{" "}
              <span className="text-slate-600">consulta(s) de este paciente en la clínica</span>
            </p>
            <p className="text-slate-400">|</p>
            <p>
              <span className="font-semibold text-slate-900">{clinicTotal ?? 0}</span>{" "}
              <span className="text-slate-600">consultas totales en la clínica</span>
            </p>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Orden cronológico desde la primera atención registrada.
            {totalPages > 1 ? ` Página ${safePage} de ${totalPages}.` : ""}
          </p>
          <div className="mt-3">
            <PatientWhatsAppButton
              phone={patient.phone}
              message={buildPatientContactMessage(
                `${patient.first_name} ${patient.last_name}`
              )}
              label="WhatsApp"
              size="md"
            />
          </div>
        </div>

        {total === 0 ? (
          <Card title="Sin consultas">
            <p className="text-sm text-slate-600">Este paciente aún no tiene historias registradas.</p>
            <Link href={`/historias/nueva?patient=${patientId}`} className="mt-4 inline-block">
              <Button>Registrar primera consulta</Button>
            </Link>
          </Card>
        ) : (
          <>
            <Card title={`Línea de tiempo · ${records?.length ?? 0} en esta página`}>
              <ol className="relative space-y-0 border-l-2 border-blue-200 pl-6">
                {(records ?? []).map((r, index) => {
                  const professional =
                    (r.professionals as { profiles?: { full_name?: string } } | null)?.profiles
                      ?.full_name ?? "Profesional";
                  const globalIndex = from + index + 1;
                  return (
                    <li key={r.id} className="relative pb-8 last:pb-0">
                      <span className="absolute -left-[1.65rem] flex h-7 w-7 items-center justify-center rounded-full bg-blue-700 text-xs font-bold text-white">
                        {globalIndex}
                      </span>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {format(new Date(r.created_at), "PPPP", { locale: es })}
                            </p>
                            <p className="text-sm text-slate-500">
                              {format(new Date(r.created_at), "p", { locale: es })} · {professional}
                            </p>
                          </div>
                          <Link href={`/historias/${r.id}`}>
                            <Button variant="outline" size="sm">
                              Ver detalle
                            </Button>
                          </Link>
                        </div>
                        {r.chief_complaint ? (
                          <div className="mt-3">
                            <p className="text-xs font-semibold uppercase text-slate-500">Motivo</p>
                            <p className="text-sm text-slate-800">{r.chief_complaint}</p>
                          </div>
                        ) : null}
                        {r.diagnosis ? (
                          <div className="mt-2">
                            <p className="text-xs font-semibold uppercase text-slate-500">Diagnóstico</p>
                            <p className="text-sm text-slate-800">{r.diagnosis}</p>
                          </div>
                        ) : null}
                        {r.evolution ? (
                          <div className="mt-2">
                            <p className="text-xs font-semibold uppercase text-slate-500">Evolución</p>
                            <p className="line-clamp-4 whitespace-pre-wrap text-sm text-slate-700">
                              {r.evolution}
                            </p>
                          </div>
                        ) : null}
                        {r.indications ? (
                          <div className="mt-2">
                            <p className="text-xs font-semibold uppercase text-slate-500">Indicaciones</p>
                            <p className="line-clamp-3 whitespace-pre-wrap text-sm text-slate-700">
                              {r.indications}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4">
                {safePage > 1 && (
                  <Link href={pageQuery(safePage - 1)}>
                    <Button variant="outline" size="sm">
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                  </Link>
                )}
                <span className="text-sm text-slate-600">
                  Página {safePage} de {totalPages} · {total} consultas
                </span>
                {safePage < totalPages && (
                  <Link href={pageQuery(safePage + 1)}>
                    <Button variant="outline" size="sm">
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
