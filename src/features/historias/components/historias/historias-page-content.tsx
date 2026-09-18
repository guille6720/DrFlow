import { ChevronLeft, ChevronRight, FileText, Plus } from "lucide-react";
import Link from "next/link";

import { ClinicalRecordsGroupedList } from "@/features/historias";
import { buildHistoriasUrl, type HistoriasPageData } from "@/features/historias/server/load-historias-page";
import { ClinicalCopilotAccessButton } from "@/features/ia/components/clinical-workflow/clinical-copilot-access-button";
import { HistoriasCopilotSessionBridge } from "@/features/ia/components/clinical-workflow/historias-copilot-session-bridge";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListPagination, ListPaginationLabel } from "@/components/ui/list-pagination";
import { ProminentSearchForm } from "@/components/ui/prominent-search-form";
import { SectorHero } from "@/components/ui/sector-hero";

type Props = HistoriasPageData & { q: string };

export function HistoriasPageContent({
  q,
  records,
  listTitle,
  noMatchPatients,
  totalRecords,
  clinicTotalRecords,
  groups,
  singlePatientFromSearch,
  totalPages,
  safePage,
  nextCursor,
  prevCursor,
  paginationError,
}: Props) {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <HistoriasCopilotSessionBridge
        groups={groups}
        singlePatientFromSearch={singlePatientFromSearch}
      />

      <SectorHero
        icon={FileText}
        title="Historia clínica"
        subtitle="Buscá por paciente, abrí «Toda su historia» o consultá con el asistente IA. Importación masiva en Importar / Exportar."
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
          <>
            <ClinicalCopilotAccessButton
              label="Asistente IA"
              className="border-violet-200 bg-white/90 text-violet-900 hover:bg-violet-50"
            />
            <Link href="/consultas">
            <Button>
              <Plus className="h-4 w-4" />
              Nueva consulta
            </Button>
            </Link>
          </>
        }
      />

      {noMatchPatients ? (
        <EmptyState
          icon={FileText}
          title="Sin resultados"
          description={`No encontramos pacientes para “${q}”. Probá con otro nombre o DNI.`}
        />
      ) : paginationError ? (
        <EmptyState
          icon={FileText}
          title="Paginación no disponible"
          description={paginationError}
          action={
            <Link href={buildHistoriasUrl({ q: q || undefined })}>
              <Button variant="outline">Volver al inicio</Button>
            </Link>
          }
        />
      ) : records.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Sin registros clínicos"
          description="Las consultas que registres aparecerán acá."
          action={
            <Link href="/consultas">
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

          {(totalPages > 1 || totalRecords > 0 || nextCursor || prevCursor) && (
            <ListPagination>
              {(safePage > 1 || prevCursor) && (
                <Link
                  href={
                    safePage <= 2
                      ? buildHistoriasUrl({ q: q || undefined })
                      : buildHistoriasUrl({
                          q: q || undefined,
                          page: safePage - 1,
                          before: prevCursor,
                        })
                  }
                >
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
              {(safePage < totalPages || nextCursor) && (
                <Link
                  href={buildHistoriasUrl({
                    q: q || undefined,
                    page: safePage + 1,
                    cursor: nextCursor,
                  })}
                >
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
  );
}
