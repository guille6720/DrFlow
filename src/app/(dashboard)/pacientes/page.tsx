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
import { formatAgeLabel, isPamiPatient } from "@/lib/utils/patient-age";
import { Badge } from "@/components/ui/badge";
import { PatientAppShareControl } from "@/components/pacientes/patient-app-share-control";
import { getDoctorShareInfoForClinic, getPortalSlugForClinic } from "@/lib/utils/portal-doctor-info";
import { Users, Plus, Search, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { hasPermission } from "@/lib/permissions/roles";
import { PatientsImportExportHub } from "@/components/pacientes/patients-import-export-hub";
import type { PatientExportRow } from "@/lib/utils/clinical-export-client";

const PAGE_SIZE = 20;
const EXPORT_LIMIT = 5000;

export const maxDuration = 300;

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; cobertura?: string }>;
}) {
  const { q, page: pageStr, cobertura } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  const canImportConsumers = hasPermission(role, "managePatients", isSuperadmin);
  const supabase = await createClient();

  let patients: {
    id: string;
    first_name: string;
    last_name: string;
    document_number: string;
    birth_date: string | null;
    phone: string | null;
    email: string | null;
    insurance_provider: string | null;
  }[] = [];
  let exportPatients: PatientExportRow[] = [];
  let total = 0;
  let portalSlug: string | null = null;
  let doctorInfo: Awaited<ReturnType<typeof getDoctorShareInfoForClinic>> = null;
  const shareByPatient = new Map<
    string,
    { sharedAt: string; sharedByName?: string | null; channel?: string | null }
  >();

  if (clinicId) {
    portalSlug = await getPortalSlugForClinic(clinicId);
    if (portalSlug) {
      doctorInfo = await getDoctorShareInfoForClinic(clinicId);
    }

    let query = supabase
      .from("patients")
      .select("id, first_name, last_name, document_number, birth_date, phone, email, insurance_provider", {
        count: "exact",
      })
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("last_name");

    if (q) {
      query = query.or(
        `first_name.ilike.%${q}%,last_name.ilike.%${q}%,document_number.ilike.%${q}%`
      );
    }
    if (cobertura === "pami") {
      query = query.ilike("insurance_provider", "%PAMI%");
    }

    const from = (page - 1) * PAGE_SIZE;
    const { data, count } = await query.range(from, from + PAGE_SIZE - 1);
    patients = data ?? [];
    total = count ?? 0;

    let exportQuery = supabase
      .from("patients")
      .select("first_name, last_name, document_number, birth_date, phone, email, insurance_provider")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("last_name")
      .limit(EXPORT_LIMIT);

    if (q) {
      exportQuery = exportQuery.or(
        `first_name.ilike.%${q}%,last_name.ilike.%${q}%,document_number.ilike.%${q}%`
      );
    }
    if (cobertura === "pami") {
      exportQuery = exportQuery.ilike("insurance_provider", "%PAMI%");
    }
    const { data: exportData } = await exportQuery;
    exportPatients =
      exportData?.map((p) => ({
        first_name: p.first_name,
        last_name: p.last_name,
        document_number: p.document_number,
        phone: p.phone ?? "",
        email: p.email ?? "",
        insurance_provider: p.insurance_provider ?? "",
        birth_date: p.birth_date ?? "",
      })) ?? [];

    if (patients.length > 0 && portalSlug) {
      const { data: shares } = await supabase
        .from("patient_app_share_log")
        .select("patient_id, shared_at, channel, profiles(full_name)")
        .eq("clinic_id", clinicId)
        .in(
          "patient_id",
          patients.map((p) => p.id)
        );

      for (const row of shares ?? []) {
        const profileRow = row.profiles as { full_name?: string } | null;
        shareByPatient.set(row.patient_id, {
          sharedAt: row.shared_at,
          sharedByName: profileRow?.full_name ?? null,
          channel: row.channel,
        });
      }
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageQuery = (p: number) =>
    `/pacientes?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}${cobertura === "pami" ? "&cobertura=pami" : ""}`;

  const exportLabel = q
    ? `búsqueda “${q}”`
    : cobertura === "pami"
      ? "solo PAMI"
      : "todos los activos";

  return (
    <>
      <Header
        title="Pacientes"
        subtitle={`${total} pacientes activos`}
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />

      <div className="space-y-4 p-4 sm:p-6">
        <PatientsImportExportHub
          canImport={canImportConsumers}
          exportPatients={exportPatients}
          exportLabel={exportLabel}
        />

        <Card title="Buscar pacientes">
          <div className="flex flex-wrap items-center gap-3">
            <form className="flex flex-1 flex-wrap gap-2" action="/pacientes">
              {cobertura === "pami" && <input type="hidden" name="cobertura" value="pami" />}
              <div className="relative min-w-[200px] flex-1 max-w-lg">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Buscar por nombre o DNI…"
                  className="w-full rounded-xl border border-blue-200 py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <Button type="submit" variant="secondary">
                Buscar
              </Button>
              {q && (
                <Link href={cobertura === "pami" ? "/pacientes?cobertura=pami" : "/pacientes"}>
                  <Button type="button" variant="outline">
                    Limpiar
                  </Button>
                </Link>
              )}
            </form>
            <Link href={cobertura === "pami" ? "/pacientes" : "/pacientes?cobertura=pami"}>
              <Button variant="outline" size="sm">
                {cobertura === "pami" ? "Todos" : "Solo PAMI"}
              </Button>
            </Link>
            <Link href="/pacientes/nuevo">
              <Button>
                <Plus className="h-4 w-4" />
                Nuevo paciente
              </Button>
            </Link>
          </div>
        </Card>

        {patients.length === 0 ? (
          <EmptyState
            icon={Users}
            title={q ? "Sin resultados" : "No hay pacientes registrados"}
            description={
              q
                ? `No hay pacientes que coincidan con “${q}”.`
                : "Podés cargar 12 pacientes ficticios desde Configuración → Datos de prueba, o crear el primero manualmente."
            }
            action={
              !q ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <Link href="/configuracion#datos-demo">
                    <Button variant="secondary">Cargar pacientes demo</Button>
                  </Link>
                  <Link href="/pacientes/nuevo">
                    <Button>
                      <Plus className="h-4 w-4" />
                      Nuevo paciente
                    </Button>
                  </Link>
                </div>
              ) : undefined
            }
          />
        ) : (
          <>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-blue-50 text-left text-slate-500">
                      <th className="pb-3 pr-4 font-medium">Apellido y nombre</th>
                      <th className="pb-3 pr-4 font-medium">DNI</th>
                      <th className="pb-3 pr-4 font-medium">Contacto</th>
                      <th className="pb-3 pr-4 font-medium">Edad</th>
                      <th className="pb-3 pr-4 font-medium">Obra social</th>
                      {portalSlug && doctorInfo && (
                        <th className="pb-3 pr-4 font-medium">App paciente</th>
                      )}
                      <th className="pb-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {patients.map((p) => (
                      <tr key={p.id} className="text-slate-700 hover:bg-blue-50/30">
                        <td className="py-3 pr-4 font-medium text-slate-900">
                          {p.last_name}, {p.first_name}
                        </td>
                        <td className="py-3 pr-4">{p.document_number}</td>
                        <td className="py-3 pr-4">{p.phone ?? p.email ?? "—"}</td>
                        <td className="py-3 pr-4">{formatAgeLabel(p.birth_date) ?? "—"}</td>
                        <td className="py-3 pr-4">
                          <span className="inline-flex items-center gap-1">
                            {p.insurance_provider ?? "—"}
                            {isPamiPatient(p.insurance_provider) && (
                              <Badge variant="teal">PAMI</Badge>
                            )}
                          </span>
                        </td>
                        {portalSlug && doctorInfo && (
                          <td className="py-3 pr-4">
                            <PatientAppShareControl
                              patientId={p.id}
                              patientName={`${p.first_name} ${p.last_name}`}
                              patientPhone={p.phone}
                              slug={portalSlug}
                              doctor={doctorInfo}
                              share={shareByPatient.get(p.id) ?? null}
                              compact
                            />
                          </td>
                        )}
                        <td className="py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/historias?patient=${p.id}`}>
                              <Button variant="outline" size="sm">
                                <FileText className="h-3.5 w-3.5" />
                                Historia clínica
                              </Button>
                            </Link>
                            <Link href={`/pacientes/${p.id}`} className="text-blue-700 hover:underline">
                              Ver
                            </Link>
                            <Link href={`/pacientes/${p.id}/editar`} className="text-blue-600 hover:underline">
                              Editar
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4">
                {page > 1 && (
                  <Link href={pageQuery(page - 1)}>
                    <Button variant="outline" size="sm">
                      <ChevronLeft className="h-4 w-4" /> Anterior
                    </Button>
                  </Link>
                )}
                <span className="text-sm text-slate-500">
                  Página {page} de {totalPages}
                </span>
                {page < totalPages && (
                  <Link href={pageQuery(page + 1)}>
                    <Button variant="outline" size="sm">
                      Siguiente <ChevronRight className="h-4 w-4" />
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
