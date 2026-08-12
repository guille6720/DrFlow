import { Users } from "lucide-react";

import type { HistoriasPageData } from "@/features/historias/server/load-historias-page";
import { ClinicalHistoriasListPanel } from "@/features/pacientes/components/pacientes/clinical-historias-list-panel";
import { PacientesListPanel } from "@/features/pacientes/components/pacientes/pacientes-list-panel";
import { PacientesSectionNav } from "@/features/pacientes/components/pacientes/pacientes-section-nav";
import type { PacientesPageData } from "@/features/pacientes/server/load-pacientes-page";
import { type PacientesPageSection } from "@/features/pacientes/utils/pacientes-page-url";

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
    <div className="space-y-4 p-3 sm:p-4">
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

          <PacientesListPanel
            {...{
              patients,
              total,
              portalSlug,
              doctorInfo,
              shareByPatient,
              totalPages,
              page,
            }}
            q={q}
            patologia={patologia}
            cobertura={cobertura}
            canIssuePrescriptions={canIssuePrescriptions}
            hasSearch={hasSearch}
          />
        </>
      )}
    </div>
  );
}
