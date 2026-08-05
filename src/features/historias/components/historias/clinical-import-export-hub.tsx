"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import { ImportClinicalCsvPanel } from "@/features/historias/components/historias/import-clinical-csv-panel";
import { ImportClinicalPdfPanel } from "@/features/historias/components/historias/import-clinical-pdf-panel";
import { ImportHceExportPanel } from "@/features/historias/components/historias/import-hce-export-panel";
import { ImportTeamsJsonlPanel } from "@/features/historias/components/historias/import-teams-jsonl-panel";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  type ClinicalRecordExportRow,
  downloadClinicalHistoryPdf,
  downloadClinicalRecordsCsv,
  downloadClinicalRecordsListPdf,
} from "@/lib/utils/clinical-export-client";

const IMPORT_OPTIONS = [
  { value: "pdf", label: "Historias PDF (una o en lote)" },
  { value: "csv", label: "Consultas CSV (plantilla DrFlow)" },
  { value: "hce", label: "Export HCE (HCE_export.csv)" },
  { value: "jsonl", label: "Export teams (teams-*.jsonl)" },
];

const EXPORT_OPTIONS = [
  { value: "", label: "Elegí formato…" },
  { value: "records-csv", label: "Consultas visibles (CSV)" },
  { value: "records-pdf", label: "Consultas visibles (PDF)" },
  { value: "history-pdf", label: "Historia completa del paciente (PDF)" },
];

interface Props {
  canImport: boolean;
  exportRecords: ClinicalRecordExportRow[];
  exportTitle: string;
  focusedPatient?: {
    first_name: string;
    last_name: string;
    document_number: string;
  } | null;
  sidebar?: boolean;
}

export function ClinicalImportExportHub({
  canImport,
  exportRecords,
  exportTitle,
  focusedPatient,
  sidebar,
}: Props) {
  const [importKind, setImportKind] = useState("pdf");
  const [exportKind, setExportKind] = useState("");

  function handleExport() {
    if (!exportKind || exportRecords.length === 0) return;
    if (exportKind === "records-csv") {
      downloadClinicalRecordsCsv("consultas-clinicas.csv", exportRecords);
    } else if (exportKind === "records-pdf") {
      void downloadClinicalRecordsListPdf(exportRecords, exportTitle);
    } else if (exportKind === "history-pdf" && focusedPatient) {
      void downloadClinicalHistoryPdf(focusedPatient, exportRecords);
    }
  }

  const historyPdfDisabled = exportKind === "history-pdf" && !focusedPatient;

  const body = (
    <>
      {!sidebar && (
        <p className="mb-4 text-sm text-slate-600">
          Cargá archivos desde migraciones o descargá las consultas que ves en pantalla (según el
          buscador).
        </p>
      )}

      <div className={sidebar ? "space-y-4" : "grid gap-8 lg:grid-cols-2"}>
        <div className="space-y-3">
          <Select
            label="Importar desde archivo"
            value={importKind}
            onChange={(e) => setImportKind(e.target.value)}
            options={IMPORT_OPTIONS}
          />
          {canImport && importKind === "pdf" && (
            <ImportClinicalPdfPanel embedded canImport={canImport} />
          )}
          {canImport && importKind === "csv" && (
            <ImportClinicalCsvPanel embedded canImport={canImport} />
          )}
          {canImport && importKind === "hce" && (
            <ImportHceExportPanel embedded canImport={canImport} />
          )}
          {canImport && importKind === "jsonl" && (
            <ImportTeamsJsonlPanel embedded canImport={canImport} />
          )}
          {!canImport && (
            <p className="text-sm text-slate-500">No tenés permisos para importar historias.</p>
          )}
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-4 lg:border-t-0 lg:pt-0">
          <Select
            label="Descargar datos"
            value={exportKind}
            onChange={(e) => setExportKind(e.target.value)}
            options={EXPORT_OPTIONS}
          />
          <p className="text-xs text-slate-500">
            {exportRecords.length} consulta(s) · {exportTitle}
            {focusedPatient
              ? ` · ${focusedPatient.last_name}, ${focusedPatient.first_name}`
              : ""}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={!exportKind || exportRecords.length === 0 || historyPdfDisabled}
            onClick={handleExport}
          >
            <Download className="h-4 w-4" />
            Descargar
          </Button>
          {historyPdfDisabled && !sidebar && (
            <p className="text-xs text-amber-800">
              Para PDF de historia completa, buscá un paciente en Historia clínica o abrí su ficha
              desde Pacientes.
            </p>
          )}
        </div>
      </div>
    </>
  );

  if (sidebar) {
    return (
      <section
        id="import-historias"
        className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Historias clínicas</h2>
        {body}
      </section>
    );
  }

  return (
    <Card title="Importar y exportar historias clínicas">
      {body}
    </Card>
  );
}
