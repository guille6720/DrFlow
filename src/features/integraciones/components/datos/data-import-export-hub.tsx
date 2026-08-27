"use client";

import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { AddonUpgradeNotice } from "@/core/components/entitlements/addon-upgrade-notice";
import { useCanUseFeature } from "@/core/components/entitlements/entitlements-provider";
import { addonFeatureForDatosExportFlujo } from "@/core/entitlements/datos-features";
import { FEATURES } from "@/core/entitlements/features";

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
  // Accept legacy `type=` bookmarks as alias of `flujo=`.
  const flujo = (params.get("flujo") ?? params.get("type") ?? "") as DatosFlujo | "";
  const canUseFhir = useCanUseFeature(FEATURES.INTEGRATIONS);
  const canUseDataExport = useCanUseFeature(FEATURES.DATA_EXPORT);
  const importCards = IMPORT_CARDS.filter((card) => card.flujo !== "import-fhir" || canUseFhir);
  const exportCards = EXPORT_CARDS.filter((card) => {
    // Bulk clinical export stays visible for admins; DATA_EXPORT is checked in-panel/server.
    if (card.flujo === "export-masivo") return props.canBulkExport;
    const addon = addonFeatureForDatosExportFlujo(card.flujo);
    if (!addon) return true;
    return canUseDataExport;
  });

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
          <ArrowUpFromLine className="h-4 w-4" />
          Importar datos
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {importCards.map((card) => (
            <HubCard key={card.flujo} {...card} active={flujo === card.flujo} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
          <ArrowDownToLine className="h-4 w-4" />
          Exportar datos
        </h2>
        {!canUseDataExport ? (
          <div className="mb-3">
            <AddonUpgradeNotice feature={FEATURES.DATA_EXPORT} />
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {exportCards.map((card) => (
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
