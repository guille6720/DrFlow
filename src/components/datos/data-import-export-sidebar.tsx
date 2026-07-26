"use client";

import { ClinicalImportExportHub } from "@/components/historias/clinical-import-export-hub";
import { PatientsImportExportHub } from "@/components/pacientes/patients-import-export-hub";
import type { ClinicalRecordExportRow, PatientExportRow } from "@/lib/utils/clinical-export-client";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

interface Props {
  canImportPatients: boolean;
  canImportClinical: boolean;
  exportPatients: PatientExportRow[];
  exportRecords: ClinicalRecordExportRow[];
}

export function DataImportExportSidebar({
  canImportPatients,
  canImportClinical,
  exportPatients,
  exportRecords,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-200/80 bg-slate-900 px-4 py-3 text-white shadow-lg">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <ArrowUpFromLine className="h-4 w-4 text-blue-300" />
          Importación
        </p>
        <p className="mt-1 text-xs text-blue-100/90">
          Elegí el tipo de archivo en cada bloque y subilo desde acá.
        </p>
      </div>

      <PatientsImportExportHub
        sidebar
        canImport={canImportPatients}
        exportPatients={exportPatients}
        exportLabel="todos los pacientes activos"
      />

      <ClinicalImportExportHub
        sidebar
        canImport={canImportClinical}
        exportRecords={exportRecords}
        exportTitle="Últimas consultas de la clínica (hasta 2000)"
      />

      <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-900">
        <p className="flex items-center gap-2 font-semibold">
          <ArrowDownToLine className="h-4 w-4" />
          Exportación
        </p>
        <p className="mt-1">
          Usá «Descargar datos» en cada bloque. Para filtrar consultas por paciente, buscá en
          Historia clínica y exportá desde acá con el padrón completo de consultas recientes.
        </p>
      </div>
    </div>
  );
}
