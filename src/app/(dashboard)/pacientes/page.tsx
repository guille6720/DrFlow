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
import { Users, Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 20;

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
  const { role, clinic } = await getActiveClinic();
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
        const profile = row.profiles as { full_name?: string } | null;
        shareByPatient.set(row.patient_id, {
          sharedAt: row.shared_at,
          sharedByName: profile?.full_name ?? null,
          channel: row.channel,
        });
      }
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageQuery = (p: number) =>
    `/pacientes?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}${cobertura === "pami" ? "&cobertura=pami" : ""}`;

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
        <div className="flex flex-wrap items-center gap-3">
          <form className="flex flex-1 gap-2" action="/pacientes">
            {cobertura === "pami" && <input type="hidden" name="cobertura" value="pami" />}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Buscar por nombre o DNI..."
                className="w-full rounded-xl border border-blue-200 py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <Button type="submit" variant="secondary">Buscar</Button>
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

        {patients.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No hay pacientes registrados"
            description="Podés cargar 12 pacientes ficticios desde Configuración → Datos de prueba, o crear el primero manualmente."
            action={
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
                      <th className="pb-3 font-medium"></th>
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
                        <td className="py-3 space-x-3">
                          <Link href={`/pacientes/${p.id}`} className="text-blue-700 hover:underline">
                            Ver
                          </Link>
                          <Link href={`/pacientes/${p.id}/editar`} className="text-blue-600 hover:underline">
                            Editar
                          </Link>
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
