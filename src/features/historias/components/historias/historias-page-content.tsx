import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectorHero } from "@/components/ui/sector-hero";
import { ListPagination, ListPaginationLabel } from "@/components/ui/list-pagination";
import { ProminentSearchForm } from "@/components/ui/prominent-search-form";
import { ClinicalRecordsGroupedList } from "@/features/historias";
import { buildHistoriasUrl, type HistoriasPageData } from "@/features/historias/server/load-historias-page";
import { FileText, Plus, ChevronLeft, ChevronRight } from "lucide-react";

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
}: Props) {
  return (
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
  );
}
