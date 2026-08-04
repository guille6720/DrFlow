import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectorHero } from "@/components/ui/sector-hero";
import { ListPagination, ListPaginationLabel } from "@/components/ui/list-pagination";
import { ProminentSearchForm } from "@/components/ui/prominent-search-form";
import { PatientsListCards } from "@/features/pacientes";
import {
  buildPacientesPageQuery,
  resolvePacientesClearHref,
  type PacientesPageData,
} from "@/features/pacientes/server/load-pacientes-page";
import { formatAgeLabel } from "@/features/pacientes/utils/patient-age";
import { Users, Plus, ChevronLeft, ChevronRight } from "lucide-react";

type Props = PacientesPageData & {
  q: string;
  cobertura?: string;
  canIssuePrescriptions: boolean;
};

export function PacientesPageContent({
  patients,
  total,
  portalSlug,
  doctorInfo,
  shareByPatient,
  totalPages,
  page,
  q,
  cobertura,
  canIssuePrescriptions,
}: Props) {
  const clearHref = resolvePacientesClearHref(q, cobertura);

  return (
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
                <Link href={buildPacientesPageQuery(page - 1, q, cobertura)}>
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
                <Link href={buildPacientesPageQuery(page + 1, q, cobertura)}>
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
  );
}
