import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { FileText, Plus, Search } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PatientWhatsAppButton } from "@/components/ui/patient-whatsapp-button";
import { buildPatientContactMessage } from "@/lib/utils/patient-messages";
import { ClinicalImportExportHub } from "@/components/historias/clinical-import-export-hub";
import { hasPermission } from "@/lib/permissions/roles";
import type { ClinicalRecordExportRow } from "@/lib/utils/clinical-export-client";

export const maxDuration = 300;

const LIST_LIMIT = 500;

function sanitizeSearchTerm(raw: string | undefined): string {
  return (raw ?? "").trim().slice(0, 80);
}

export default async function HistoriasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; patient?: string }>;
}) {
  const { q: qRaw, patient: patientIdParam } = await searchParams;
  const q = sanitizeSearchTerm(qRaw);
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  const supabase = await createClient();
  const canImportClinicalPdf =
    hasPermission(role, "editClinicalRecords", isSuperadmin) ||
    hasPermission(role, "managePatients", isSuperadmin);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let records: any[] = [];
  let focusedPatient: {
    id: string;
    first_name: string;
    last_name: string;
    document_number: string;
  } | null = null;
  let exportTitle = "Últimas consultas de la clínica";
  let noMatchPatients = false;

  if (clinicId) {
    const selectFields =
      "id, patient_id, diagnosis, chief_complaint, evolution, indications, created_at, patients(first_name, last_name, phone, document_number), professionals(profiles(full_name))";

    let patientIds: string[] | null = null;

    if (patientIdParam) {
      const { data: patient } = await supabase
        .from("patients")
        .select("id, first_name, last_name, document_number")
        .eq("clinic_id", clinicId)
        .eq("id", patientIdParam)
        .maybeSingle();
      if (patient) {
        focusedPatient = patient;
        patientIds = [patient.id];
        exportTitle = `Historia de ${patient.last_name}, ${patient.first_name}`;
      }
    } else if (q) {
      const { data: matched } = await supabase
        .from("patients")
        .select("id, first_name, last_name, document_number")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,document_number.ilike.%${q}%`)
        .limit(30);

      if (!matched?.length) {
        noMatchPatients = true;
      } else {
        patientIds = matched.map((p) => p.id);
        if (matched.length === 1) {
          focusedPatient = matched[0];
          exportTitle = `Historia de ${matched[0].last_name}, ${matched[0].first_name}`;
        } else {
          exportTitle = `Consultas de ${matched.length} pacientes (búsqueda: ${q})`;
        }
      }
    }

    let query = supabase
      .from("clinical_records")
      .select(selectFields)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT);

    if (patientIds) {
      query = query.in("patient_id", patientIds);
    } else if (!q && !patientIdParam) {
      exportTitle = "Últimas 50 consultas";
      query = query.limit(50);
    }

    const { data } = await query;
    records = data ?? [];
  }

  const exportRecords: ClinicalRecordExportRow[] = records.map((r) => {
    const patient = r.patients;
    const patientName = patient
      ? `${patient.last_name}, ${patient.first_name}`
      : "Paciente";
    return {
      created_at: r.created_at,
      patient_name: patientName,
      document_number: patient?.document_number ?? "",
      professional_name: r.professionals?.profiles?.full_name ?? "Profesional",
      chief_complaint: r.chief_complaint ?? "",
      diagnosis: r.diagnosis ?? "",
      evolution: r.evolution ?? "",
      indications: r.indications ?? "",
    };
  });

  const historiasQuery = (params: { q?: string; patient?: string }) => {
    const parts = new URLSearchParams();
    if (params.q) parts.set("q", params.q);
    if (params.patient) parts.set("patient", params.patient);
    const s = parts.toString();
    return s ? `/historias?${s}` : "/historias";
  };

  return (
    <>
      <Header
        title="Historia clínica digital"
        subtitle="Registro seguro de consultas médicas"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />

      <div className="space-y-4 p-4 sm:p-6">
        <ClinicalImportExportHub
          canImport={canImportClinicalPdf}
          exportRecords={exportRecords}
          exportTitle={exportTitle}
          focusedPatient={
            focusedPatient
              ? {
                  first_name: focusedPatient.first_name,
                  last_name: focusedPatient.last_name,
                  document_number: focusedPatient.document_number,
                }
              : null
          }
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <form className="flex flex-1 flex-wrap gap-2" action="/historias">
            <div className="relative min-w-[200px] flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Buscar paciente por nombre o DNI…"
                className="w-full rounded-xl border border-blue-200 py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <Button type="submit" variant="secondary">
              Buscar historia
            </Button>
            {(q || patientIdParam) && (
              <Link href="/historias">
                <Button type="button" variant="outline">
                  Ver todas
                </Button>
              </Link>
            )}
          </form>
          <Link href="/historias/nueva">
            <Button>
              <Plus className="h-4 w-4" />
              Nueva consulta
            </Button>
          </Link>
        </div>

        {focusedPatient && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm">
            <p className="font-medium text-slate-900">
              Historia clínica completa · {focusedPatient.last_name}, {focusedPatient.first_name}{" "}
              <span className="font-normal text-slate-600">DNI {focusedPatient.document_number}</span>
            </p>
            <Link href={`/pacientes/${focusedPatient.id}`}>
              <Button variant="outline" size="sm">
                Ficha del paciente
              </Button>
            </Link>
          </div>
        )}

        {noMatchPatients ? (
          <EmptyState
            icon={FileText}
            title="Sin resultados"
            description={`No encontramos pacientes para “${q}”. Probá con otro nombre o DNI.`}
          />
        ) : records.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Sin registros clínicos"
            description="Las consultas que registres aparecerán acá. Para probar rápido, cargá datos demo desde Configuración."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/configuracion#datos-demo">
                  <Button variant="secondary">Cargar datos demo</Button>
                </Link>
                <Link href="/historias/nueva">
                  <Button>
                    <Plus className="h-4 w-4" />
                    Registrar consulta
                  </Button>
                </Link>
              </div>
            }
          />
        ) : (
          <Card
            title={
              q || patientIdParam
                ? `${records.length} consulta(s) · ${exportTitle}`
                : "Consultas recientes"
            }
          >
            <ul className="divide-y divide-slate-100">
              {records.map((r) => {
                const patientName = r.patients
                  ? `${r.patients.first_name} ${r.patients.last_name}`
                  : "Paciente";
                const patientId = r.patient_id as string;
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">
                        {r.patients
                          ? `${r.patients.last_name}, ${r.patients.first_name}`
                          : "Paciente"}
                      </p>
                      <p className="text-sm text-slate-500">
                        {format(new Date(r.created_at), "PPp", { locale: es })}
                        {" · "}
                        {r.professionals?.profiles?.full_name ?? "Profesional"}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {r.diagnosis ?? r.chief_complaint ?? "Sin diagnóstico"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      <PatientWhatsAppButton
                        phone={r.patients?.phone}
                        message={buildPatientContactMessage(
                          patientName,
                          r.professionals?.profiles?.full_name ?? undefined
                        )}
                        size="icon"
                      />
                      {patientId && (
                        <Link
                          href={historiasQuery({ patient: patientId })}
                          className="text-sm text-blue-700 hover:underline"
                        >
                          Toda su historia
                        </Link>
                      )}
                      {patientId && (
                        <Link
                          href={`/pacientes/${patientId}`}
                          className="text-sm text-slate-600 hover:underline"
                        >
                          Paciente
                        </Link>
                      )}
                      <Link href={`/historias/${r.id}`} className="text-sm text-blue-700 hover:underline">
                        Ver detalle
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
