"use client";

import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useSearchParams } from "next/navigation";

import {
  type DatosFlujo,
  type DatosHubProps,
  EXPORT_CARDS,
  FlujoBody,
  HubCard,
  IMPORT_CARDS,
  titleForFlujo,
} from "@/features/integraciones/components/datos/data-import-export-flujo";

import { Card } from "@/components/ui/card";

export type { DatosFlujo };

export function DataImportExportHub(props: DatosHubProps) {
  const params = useSearchParams();
  const flujo = (params.get("flujo") ?? "") as DatosFlujo | "";

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
          <ArrowUpFromLine className="h-4 w-4" />
          Importar datos
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {IMPORT_CARDS.map((card) => (
            <HubCard key={card.flujo} {...card} active={flujo === card.flujo} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
          <ArrowDownToLine className="h-4 w-4" />
          Exportar datos
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {EXPORT_CARDS.map((card) => (
            <HubCard key={card.flujo} {...card} active={flujo === card.flujo} />
          ))}
        </div>
      </section>

      {flujo ? (
        <Card title={titleForFlujo(flujo)} className="drflow-card-light bg-white">
          <FlujoBody {...props} flujo={flujo} />
        </Card>
      ) : null}
    </div>
  );
}
