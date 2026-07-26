"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ImportConsumersPanel } from "@/components/pacientes/import-consumers-panel";
import {
  downloadPatientsCsv,
  downloadPatientsPdf,
  type PatientExportRow,
} from "@/lib/utils/clinical-export-client";
import { Download } from "lucide-react";

const IMPORT_OPTIONS = [
  { value: "consumers", label: "Excel / CSV de pacientes (consumers)" },
];

const EXPORT_OPTIONS = [
  { value: "", label: "Elegí formato…" },
  { value: "patients-csv", label: "Pacientes (CSV)" },
  { value: "patients-pdf", label: "Pacientes (PDF)" },
];

interface Props {
  canImport: boolean;
  exportPatients: PatientExportRow[];
  exportLabel: string;
}

export function PatientsImportExportHub({ canImport, exportPatients, exportLabel }: Props) {
  const [importKind, setImportKind] = useState("consumers");
  const [exportKind, setExportKind] = useState("");

  function handleExport() {
    if (!exportKind || exportPatients.length === 0) return;
    if (exportKind === "patients-csv") {
      downloadPatientsCsv("pacientes-drflow.csv", exportPatients);
    } else if (exportKind === "patients-pdf") {
      downloadPatientsPdf(exportPatients);
    }
  }

  return (
    <Card title="Importar y exportar pacientes">
      <p className="mb-4 text-sm text-slate-600">
        Subí listados masivos o descargá el padrón según tu búsqueda actual ({exportLabel}).
      </p>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <Select
            label="Importar desde archivo"
            value={importKind}
            onChange={(e) => setImportKind(e.target.value)}
            options={IMPORT_OPTIONS}
          />
          {canImport && importKind === "consumers" && (
            <ImportConsumersPanel embedded canImport={canImport} />
          )}
          {!canImport && (
            <p className="text-sm text-slate-500">No tenés permisos para importar pacientes.</p>
          )}
        </div>

        <div className="space-y-3">
          <Select
            label="Descargar datos"
            value={exportKind}
            onChange={(e) => setExportKind(e.target.value)}
            options={EXPORT_OPTIONS}
          />
          <p className="text-xs text-slate-500">{exportPatients.length} paciente(s) incluidos</p>
          <Button
            type="button"
            variant="outline"
            disabled={!exportKind || exportPatients.length === 0}
            onClick={handleExport}
          >
            <Download className="h-4 w-4" />
            Descargar
          </Button>
        </div>
      </div>
    </Card>
  );
}
