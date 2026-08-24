"use client";

import {
  ArrowDownToLine,
  FileJson,
  Files,
  FileSpreadsheet,
  FileText,
  History,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ClinicalImportExportHub } from "@/features/historias/components/historias/clinical-import-export-hub";
import { BulkClinicalExportPanel } from "@/features/integraciones/components/datos/bulk-clinical-export-panel";
import { ClinicalRecordExportPanel } from "@/features/integraciones/components/datos/clinical-record-export-panel";
import { FhirImportPanel } from "@/features/integraciones/components/datos/fhir-import-panel";
import { HistoricalDocumentsImportPanel } from "@/features/integraciones/components/datos/historical-documents-import-panel";
import { ImportExportHistoryPanel } from "@/features/integraciones/components/datos/import-export-history-panel";
import { PatientExportPanel } from "@/features/integraciones/components/datos/patient-export-panel";
import { PatientImportWizard } from "@/features/integraciones/components/datos/patient-import-wizard";
import type { ImportExportHistoryRow } from "@/features/integraciones/server/load-import-export-history";
import { ImportConsumersPanel } from "@/features/pacientes/components/pacientes/import-consumers-panel";

import type { ClinicalRecordExportRow } from "@/lib/utils/clinical-export-client";

export type DatosFlujo =
  | "import-pacientes"
  | "migrar-hc"
  | "import-fhir"
  | "import-documentos"
  | "export-pacientes"
  | "export-hc"
  | "export-masivo"
  | "historial";

export type DatosHubProps = {
  canImportPatients: boolean;
  canImportClinical: boolean;
  canExportPatients: boolean;
  canExportClinical: boolean;
  canBulkExport: boolean;
  patientCount: number;
  exportRecords: ClinicalRecordExportRow[];
  history: ImportExportHistoryRow[];
  historyError?: string;
  professionals: Array<{ id: string; name: string }>;
  insuranceOptions: string[];
};

export const IMPORT_CARDS: Array<{
  flujo: DatosFlujo;
  title: string;
  description: string;
  icon: typeof FileSpreadsheet;
  phase: 1 | 2 | 3;
}> = [
  {
    flujo: "import-pacientes",
    title: "Importar pacientes",
    description: "Excel / CSV con mapeo de columnas, validación y duplicados.",
    icon: FileSpreadsheet,
    phase: 1,
  },
  {
    flujo: "migrar-hc",
    title: "Migrar historias clínicas",
    description: "CSV HCE, JSONL o consultas estructuradas.",
    icon: Stethoscope,
    phase: 1,
  },
  {
    flujo: "import-fhir",
    title: "Importar FHIR",
    description: "JSON FHIR R4 (capa de interoperabilidad).",
    icon: FileJson,
    phase: 3,
  },
  {
    flujo: "import-documentos",
    title: "Importar documentos históricos",
    description: "PDF e imágenes como adjuntos clínicos, sin extraer SOAP.",
    icon: Files,
    phase: 2,
  },
];

export const EXPORT_CARDS: Array<{
  flujo: DatosFlujo;
  title: string;
  description: string;
  icon: typeof FileSpreadsheet;
  phase: 1 | 2 | 3 | 4;
}> = [
  {
    flujo: "export-pacientes",
    title: "Exportar pacientes",
    description: "CSV o Excel del padrón activo.",
    icon: FileSpreadsheet,
    phase: 1,
  },
  {
    flujo: "export-hc",
    title: "Exportar historias",
    description: "PDF resumido, JSON estructurado o ZIP con adjuntos.",
    icon: FileText,
    phase: 2,
  },
  {
    flujo: "export-masivo",
    title: "Exportación masiva",
    description: "Filtros, secciones clínicas, CSV / Excel / JSON / FHIR / ZIP.",
    icon: ArrowDownToLine,
    phase: 4,
  },
  {
    flujo: "historial",
    title: "Historial",
    description: "Auditoría de importaciones y exportaciones.",
    icon: History,
    phase: 1,
  },
];

export function titleForFlujo(flujo: DatosFlujo): string {
  return [...IMPORT_CARDS, ...EXPORT_CARDS].find((card) => card.flujo === flujo)?.title ?? "Datos";
}

export function HubCard({
  flujo,
  title,
  description,
  icon: Icon,
  phase,
  active,
}: {
  flujo: DatosFlujo;
  title: string;
  description: string;
  icon: typeof FileSpreadsheet;
  phase: 1 | 2 | 3 | 4;
  active: boolean;
}) {
  return (
    <Link
      href={`/datos?flujo=${flujo}`}
      className={`drflow-card-light rounded-xl border p-4 text-left text-slate-900 shadow-sm transition ${
        active ? "border-teal-600 bg-teal-50" : "border-slate-200 bg-white hover:border-teal-400"
      }`}
    >
      <Icon className="mb-2 h-6 w-6 text-teal-800" />
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-700">{description}</p>
      {phase > 1 ? <p className="mt-2 text-xs font-medium text-slate-600">Fase {phase}</p> : null}
    </Link>
  );
}

export function FlujoBody(props: DatosHubProps & { flujo: DatosFlujo }): ReactNode {
  switch (props.flujo) {
    case "import-pacientes":
      return (
        <div className="space-y-8">
          <PatientImportWizard canImport={props.canImportPatients} />
          <div className="border-t border-slate-200 pt-4">
            <p className="mb-2 text-sm font-medium text-slate-800">Formato consumers (sistema anterior)</p>
            <ImportConsumersPanel embedded canImport={props.canImportPatients} />
          </div>
        </div>
      );
    case "migrar-hc":
      return (
        <ClinicalImportExportHub
          canImport={props.canImportClinical}
          exportRecords={props.exportRecords}
          exportTitle="Consultas recientes"
        />
      );
    case "import-fhir":
      return <FhirImportPanel canImport={props.canImportClinical} />;
    case "import-documentos":
      return (
        <HistoricalDocumentsImportPanel
          canImport={props.canImportClinical}
          professionals={props.professionals}
        />
      );
    case "export-pacientes":
      return <PatientExportPanel canExport={props.canExportPatients} estimatedCount={props.patientCount} />;
    case "export-hc":
      return <ClinicalRecordExportPanel canExport={props.canExportClinical} />;
    case "export-masivo":
      return (
        <BulkClinicalExportPanel
          canExport={props.canBulkExport}
          estimatedCount={props.patientCount}
          professionals={props.professionals}
          insuranceOptions={props.insuranceOptions}
        />
      );
    case "historial":
      return <ImportExportHistoryPanel rows={props.history} error={props.historyError} />;
    default:
      return null;
  }
}
