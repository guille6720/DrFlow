import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectorHero } from "@/components/ui/sector-hero";
import { ListPagination, ListPaginationLabel } from "@/components/ui/list-pagination";
import { ProminentSearchForm } from "@/components/ui/prominent-search-form";
import { PatientsListCards } from "@/features/pacientes";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatAgeLabel, isPamiPatient } from "@/lib/utils/patient-age";
import { applyPatientSearchFilter, sanitizePatientSearchTerm } from "@/lib/utils/patient-search";
import { getDoctorShareInfoForClinic, getPortalSlugForClinic } from "@/lib/utils/portal-doctor-info";
import { hasPermission } from "@/lib/permissions/roles";
import { Users, Plus, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 20;

export const maxDuration = 300;

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; cobertura?: string }>;
}) {
  const { q: qRaw, page: pageStr, cobertura } = await searchParams;
  const q = sanitizePatientSearchTerm(qRaw);
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  const canIssuePrescriptions = hasPermission(role, "issuePrescriptions", isSuperadmin);
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
      query = applyPatientSearchFilter(query, q);
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
          subtitle="Buscá por nombre o DNI. Desde cada fila abrís la historia clínica o la ficha. Importación masiva en Importar / Exportar."
        />

        <div className="flex flex-wrap gap-4 rounded-xl border border-slate-500/70 bg-slate-700/90 px-4 py-3 text-sm shadow-lg">
          <p>
            <span className="text-2xl font-bold text-teal-300">{total}</span>
            <span className="ml-2 text-slate-300">pacientes activos</span>
          </p>
          {q ? (
            <>
              <span className="text-slate-500">|</span>
              <p className="text-slate-200">
                Búsqueda: <span className="font-semibold text-teal-200">{q}</span>
              </p>
            </>
          ) : null}
        </div>

        <ProminentSearchForm
          action="/pacientes"
          placeholder="Nombre, apellido o DNI del paciente…"
          defaultValue={q}
          submitLabel="Buscar paciente"
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
                  <Link href="/configuracion?grupo=sistema&seccion=demo">
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
            <Card
              title={`Listado de pacientes · página ${page} de ${totalPages} · ${patients.length} filas`}
            >
              <PatientsListCards
                patients={patients.map((p) => ({
                  ...p,
                  ageLabel: formatAgeLabel(p.birth_date),
                }))}
                portalSlug={portalSlug}
                doctorInfo={doctorInfo}
                shareByPatient={shareByPatient}
                canIssuePrescriptions={canIssuePrescriptions}
              />
            </Card>
            {(totalPages > 1 || total > 0) && (
              <ListPagination>
                {page > 1 && (
                  <Link href={pageQuery(page - 1)}>
                    <Button variant="outline" size="sm" className="border-slate-500 bg-slate-700/80 text-slate-100 hover:bg-slate-600">
                      <ChevronLeft className="h-4 w-4" /> Anterior
                    </Button>
                  </Link>
                )}
                <ListPaginationLabel
                  current={page}
                  totalPages={totalPages}
                  suffix={`${total} pacientes`}
                />
                {page < totalPages && (
                  <Link href={pageQuery(page + 1)}>
                    <Button variant="outline" size="sm" className="border-slate-500 bg-slate-700/80 text-slate-100 hover:bg-slate-600">
                      Siguiente <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                )}
              </ListPagination>
            )}
          </>
        )}
      </div>
    </>
  );
}
