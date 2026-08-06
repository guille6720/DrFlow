import { ChevronLeft, ChevronRight, Plus, Users } from "lucide-react";
import Link from "next/link";

import type { HistoriasPageData } from "@/features/historias/server/load-historias-page";
import { PatientsListCards } from "@/features/pacientes";
import { ClinicalHistoriasListPanel } from "@/features/pacientes/components/pacientes/clinical-historias-list-panel";
import { PacientesSearchForm } from "@/features/pacientes/components/pacientes/pacientes-search-form";
import { PacientesSectionNav } from "@/features/pacientes/components/pacientes/pacientes-section-nav";
import type { PacientesPageData } from "@/features/pacientes/server/load-pacientes-page";
import {
  buildPacientesPageQuery,
  type PacientesPageSection,
} from "@/features/pacientes/utils/pacientes-page-url";
import { formatAgeLabel } from "@/features/pacientes/utils/patient-age";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListPagination, ListPaginationLabel } from "@/components/ui/list-pagination";
import { SectorHero } from "@/components/ui/sector-hero";

type Props = PacientesPageData & {
  seccion: PacientesPageSection;
  q: string;
  patologia?: string;
  cobertura?: string;
  canIssuePrescriptions: boolean;
  canViewClinical: boolean;
  historiasData: HistoriasPageData | null;
};

export function PacientesPageContent({
  seccion,
  patients,
  total,
  portalSlug,
  doctorInfo,
  shareByPatient,
  totalPages,
  page,
  q,
  patologia = "",
  cobertura,
  canIssuePrescriptions,
  canViewClinical,
  historiasData,
}: Props) {
  const hasSearch = Boolean(q || patologia);
  const showHistorias = seccion === "historias" && canViewClinical;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <SectorHero
        icon={Users}
        title="Pacientes"
        subtitle={
          showHistorias
            ? "Listado de historias clínicas por paciente. Buscá por nombre o DNI y abrí cada ficha."
            : "Buscá por nombre, DNI o patología/diagnóstico. Desde cada fila abrís la historia clínica o la ficha."
        }
      />

      {canViewClinical ? (
        <PacientesSectionNav section={seccion} q={q} patologia={patologia} cobertura={cobertura} />
      ) : null}

      {showHistorias && historiasData ? (
        <ClinicalHistoriasListPanel q={q} {...historiasData} />
      ) : (
        <>
          <div className="flex flex-wrap gap-4 rounded-xl border border-slate-500/70 bg-slate-700/90 px-4 py-3 text-sm shadow-lg">
            <p>
              <span className="text-2xl font-bold text-teal-300">{total}</span>
              <span className="ml-2 text-slate-300">pacientes activos</span>
            </p>
            {q ? (
              <>
                <span className="text-slate-500">|</span>
                <p className="text-slate-200">
                  Nombre/DNI: <span className="font-semibold text-teal-200">{q}</span>
                </p>
              </>
            ) : null}
            {patologia ? (
              <>
                <span className="text-slate-500">|</span>
                <p className="text-slate-200">
                  Patología: <span className="font-semibold text-teal-200">{patologia}</span>
                </p>
              </>
            ) : null}
          </div>

          <PacientesSearchForm
            q={q}
            patologia={patologia}
            cobertura={cobertura}
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
              title={hasSearch ? "Sin resultados" : "No hay pacientes registrados"}
              description={
                hasSearch
                  ? patologia && q
                    ? `No hay pacientes que coincidan con “${q}” y la patología “${patologia}”.`
                    : patologia
                      ? `No hay pacientes con patología o diagnóstico que coincida con “${patologia}”.`
                      : `No hay pacientes que coincidan con “${q}”.`
                  : "Podés cargar 12 pacientes ficticios desde Configuración → Datos de prueba, o crear el primero manualmente."
              }
              action={
                !hasSearch ? (
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
                    <Link href={buildPacientesPageQuery(page - 1, q, cobertura, patologia)}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-slate-500 bg-slate-700/80 text-slate-100 hover:bg-slate-600"
                      >
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
                    <Link href={buildPacientesPageQuery(page + 1, q, cobertura, patologia)}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-slate-500 bg-slate-700/80 text-slate-100 hover:bg-slate-600"
                      >
                        Siguiente <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                </ListPagination>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
