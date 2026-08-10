"use client";

import { ChevronLeft, ChevronRight, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PacientesListSkeleton } from "@/features/pacientes/components/pacientes/pacientes-list-skeleton";
import { PacientesSearchForm } from "@/features/pacientes/components/pacientes/pacientes-search-form";
import { PatientsListCards } from "@/features/pacientes/components/pacientes/patients-list-cards";
import type { PacientesPageData } from "@/features/pacientes/server/load-pacientes-page";
import { buildPacientesPageQuery } from "@/features/pacientes/utils/pacientes-page-url";
import { formatAgeLabel } from "@/features/pacientes/utils/patient-age";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListPagination, ListPaginationLabel } from "@/components/ui/list-pagination";

type Props = PacientesPageData & {
  q: string;
  patologia?: string;
  cobertura?: string;
  canIssuePrescriptions: boolean;
  hasSearch: boolean;
};

export function PacientesListPanel({
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
  hasSearch,
}: Props) {
  const [isNavigating, setIsNavigating] = useState(false);
  const showListSkeleton = isNavigating;

  return (
    <>
      <PacientesSearchForm
        q={q}
        patologia={patologia}
        cobertura={cobertura}
        onNavigatingChange={setIsNavigating}
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

      {showListSkeleton ? (
        <Card title="Buscando pacientes…">
          <PacientesListSkeleton />
        </Card>
      ) : patients.length === 0 ? (
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
  );
}
