import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectorHero } from "@/components/ui/sector-hero";
import { ListPagination, ListPaginationLabel } from "@/components/ui/list-pagination";
import { ProminentSearchForm } from "@/components/ui/prominent-search-form";
import {
  ClinicalRecordsGroupedList,
  type PatientRecordGroup,
} from "@/components/historias/clinical-records-grouped-list";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { FileText, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { applyPatientSearchFilter, sanitizePatientSearchTerm } from "@/lib/utils/patient-search";
import type { ClinicalRecordListRow } from "@/lib/utils/clinical-record-list-types";
import { patientClinicalHistoryPath } from "@/lib/utils/clinical-navigation";

export const maxDuration = 300;

const PAGE_SIZE = 25;

function buildHistoriasUrl(params: { q?: string; page?: number }) {
  const parts = new URLSearchParams();
  if (params.q) parts.set("q", params.q);
  if (params.page && params.page > 1) parts.set("page", String(params.page));
  const s = parts.toString();
  return s ? `/historias?${s}` : "/historias";
}

export default async function HistoriasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; patient?: string; page?: string }>;
}) {
  const { q: qRaw, patient: patientIdParam, page: pageStr } = await searchParams;
  const q = sanitizePatientSearchTerm(qRaw);
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);

  if (patientIdParam && !q) {
    redirect(patientClinicalHistoryPath(patientIdParam));
  }

  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role } = await getActiveClinic();
  const supabase = await createClient();

  let records: ClinicalRecordListRow[] = [];
  let listTitle = "Consultas recientes";
  let noMatchPatients = false;
  let totalRecords = 0;
  let clinicTotalRecords = 0;

  if (clinicId) {
    const { count: clinicCount } = await supabase
      .from("clinical_records")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId);
    clinicTotalRecords = clinicCount ?? 0;

    const selectFields =
      "id, patient_id, diagnosis, chief_complaint, created_at, patients(first_name, last_name, phone, document_number), professionals(profiles(full_name))";

    let patientIds: string[] | null = null;

    if (q) {
      const { data: matched } = await applyPatientSearchFilter(
        supabase
          .from("patients")
          .select("id, first_name, last_name, document_number")
          .eq("clinic_id", clinicId)
          .eq("is_active", true),
        q
      ).limit(50);

      if (!matched?.length) {
        noMatchPatients = true;
      } else {
        patientIds = matched.map((p) => p.id);
        if (matched.length === 1) {
          listTitle = `Resultados · ${matched[0].last_name}, ${matched[0].first_name}`;
        } else {
          listTitle = `Resultados · ${matched.length} pacientes (búsqueda: ${q})`;
        }
      }
    } else {
      listTitle = "Últimas consultas de la clínica";
    }

    if (!noMatchPatients) {
      let query = supabase
        .from("clinical_records")
        .select(selectFields, { count: "exact" })
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false });

      if (patientIds) {
        query = query.in("patient_id", patientIds);
      }

      const from = (page - 1) * PAGE_SIZE;
      const { data, count } = await query.range(from, from + PAGE_SIZE - 1);
      records = (data ?? []) as unknown as ClinicalRecordListRow[];
      totalRecords = count ?? 0;
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const patientCountCache = new Map<string, number>();
  const uniquePatientIds = [...new Set(records.map((r) => r.patient_id as string))];
  await Promise.all(
    uniquePatientIds.map(async (pid) => {
      if (!clinicId) return;
      const { count } = await supabase
        .from("clinical_records")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .eq("patient_id", pid);
      patientCountCache.set(pid, count ?? 0);
    })
  );

  const groupsMap = new Map<string, PatientRecordGroup>();
  for (const r of records) {
    const pid = r.patient_id as string;
    const p = r.patients as {
      first_name: string;
      last_name: string;
      phone: string | null;
      document_number: string;
    } | null;
    if (!groupsMap.has(pid)) {
      groupsMap.set(pid, {
        patientId: pid,
        firstName: p?.first_name ?? "Paciente",
        lastName: p?.last_name ?? "",
        documentNumber: p?.document_number ?? "—",
        phone: p?.phone ?? null,
        records: [],
        totalForPatient: patientCountCache.get(pid) ?? 0,
      });
    }
    groupsMap.get(pid)!.records.push({
      id: r.id,
      created_at: r.created_at,
      diagnosis: r.diagnosis,
      chief_complaint: r.chief_complaint,
      professional_name: r.professionals?.profiles?.full_name ?? "Profesional",
    });
  }

  const groups = [...groupsMap.values()].sort((a, b) =>
    `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`, "es")
  );

  for (const g of groups) {
    g.records.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  const singlePatientFromSearch =
    q && groups.length === 1 ? groups[0].patientId : null;

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

      <div className="space-y-6 p-4 sm:p-6">
        <SectorHero
          icon={FileText}
          title="Historia clínica"
          subtitle="Buscá por paciente y abrí «Toda su historia» para la línea de tiempo completa. Importación masiva en Importar / Exportar."
        />

        <div className="flex flex-wrap gap-4 rounded-xl border border-slate-500/70 bg-slate-700/90 px-4 py-3 text-sm shadow-lg">
          <p>
            <span className="text-2xl font-bold text-teal-300">{clinicTotalRecords}</span>
            <span className="ml-2 text-slate-300">consultas en la clínica</span>
          </p>
          {q && !noMatchPatients ? (
            <>
              <span className="text-slate-500">|</span>
              <p className="text-slate-200">
                <span className="font-bold text-teal-200">{totalRecords}</span>
                <span className="ml-1 text-slate-300">coinciden con la búsqueda</span>
              </p>
            </>
          ) : null}
        </div>

        <ProminentSearchForm
          action="/historias"
          placeholder="Nombre, apellido o DNI del paciente…"
          defaultValue={q}
          submitLabel="Buscar historia"
          clearHref={q ? "/historias" : undefined}
          trailing={
            <Link href="/historias/nueva">
              <Button>
                <Plus className="h-4 w-4" />
                Nueva consulta
              </Button>
            </Link>
          }
        />

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
            description="Las consultas que registres aparecerán acá."
            action={
              <Link href="/historias/nueva">
                <Button>
                  <Plus className="h-4 w-4" />
                  Registrar consulta
                </Button>
              </Link>
            }
          />
        ) : (
          <>
            <Card
              title={`${listTitle} · página ${safePage} de ${totalPages} · ${records.length} filas`}
            >
              <ClinicalRecordsGroupedList
                groups={groups}
                defaultOpenPatientId={singlePatientFromSearch}
              />
            </Card>

            {(totalPages > 1 || totalRecords > 0) && (
              <ListPagination>
                {safePage > 1 && (
                  <Link href={buildHistoriasUrl({ q: q || undefined, page: safePage - 1 })}>
                    <Button variant="outline" size="sm" className="border-slate-500 bg-slate-700/80 text-slate-100 hover:bg-slate-600">
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                  </Link>
                )}
                <ListPaginationLabel
                  current={safePage}
                  totalPages={totalPages}
                  suffix={`${totalRecords} consultas`}
                />
                {safePage < totalPages && (
                  <Link href={buildHistoriasUrl({ q: q || undefined, page: safePage + 1 })}>
                    <Button variant="outline" size="sm" className="border-slate-500 bg-slate-700/80 text-slate-100 hover:bg-slate-600">
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
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
