import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectorHero } from "@/components/ui/sector-hero";
import { ProminentSearchForm } from "@/components/ui/prominent-search-form";
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
import { Users, Plus, ChevronLeft, ChevronRight, FileText } from "lucide-react";

const PAGE_SIZE = 20;

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
  const { role } = await getActiveClinic();
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

  const clearHref =
    q || cobertura === "pami"
      ? cobertura === "pami" && !q
        ? "/pacientes"
        : q && cobertura === "pami"
          ? "/pacientes?cobertura=pami"
          : "/pacientes"
      : undefined;

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

      <div className="space-y-6 p-4 sm:p-6">
        <SectorHero
          icon={Users}
          title="Pacientes"
          subtitle={`${total} activos en la clínica. Importá o exportá listados desde Import / Export en el menú lateral.`}
        />

        <ProminentSearchForm
          action="/pacientes"
          placeholder="Buscar por nombre o DNI…"
          defaultValue={q}
          submitLabel="Buscar"
          clearHref={clearHref}
          hiddenFields={
            cobertura === "pami" ? <input type="hidden" name="cobertura" value="pami" /> : undefined
          }
          trailing={
            <>
              <Link href={cobertura === "pami" ? "/pacientes" : "/pacientes?cobertura=pami"}>
                <Button variant="outline" size="sm" className="border-amber-200 bg-white/90">
                  {cobertura === "pami" ? "Todos" : "Solo PAMI"}
                </Button>
              </Link>
              <Link href="/pacientes/nuevo">
                <Button>
                  <Plus className="h-4 w-4" />
                  Nuevo paciente
                </Button>
              </Link>
            </>
          }
        />

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
                            <Link href={`/historias/paciente/${p.id}`}>
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
