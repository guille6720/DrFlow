"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CLINICAL_CSV_MAX_BYTES,
  CLINICAL_CSV_MAX_ROWS,
} from "@/lib/constants/clinical-documents";
import { importClinicalCsv, type ImportClinicalCsvResult } from "@/lib/actions/clinical-import";
import { CLINICAL_CSV_TEMPLATE } from "@/lib/utils/clinical-csv-parse";
import Link from "next/link";
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, XCircle } from "lucide-react";

interface Props {
  canImport: boolean;
}

export function ImportClinicalCsvPanel({ canImport }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportClinicalCsvResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canImport) return null;

  function downloadTemplate() {
    const blob = new Blob([CLINICAL_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "drflow-plantilla-historias.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function processFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      setError("Seleccioná un archivo .csv");
      return;
    }
    if (file.size > CLINICAL_CSV_MAX_BYTES) {
      setError("El CSV supera el límite de 8 MB.");
      return;
    }

    setImporting(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.set("file", file);
    const importResult = await importClinicalCsv(formData);
    setResult(importResult);
    if (!importResult.success) {
      setError(importResult.error);
    }
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    router.refresh();
  }

  return (
    <Card title="Importar consultas CSV">
      <p className="mb-3 text-sm text-slate-600">
        Ideal para migraciones masivas (1000+ filas): una fila = una consulta. DrFlow crea o
        vincula pacientes por <strong>documento_dni</strong> y registra motivo, evolución,
        diagnóstico e indicaciones.
      </p>
      <p className="mb-4 text-xs text-slate-500">
        Separador <code className="rounded bg-slate-100 px-1">,</code> o{" "}
        <code className="rounded bg-slate-100 px-1">;</code> · hasta {CLINICAL_CSV_MAX_ROWS}{" "}
        filas · 8 MB máx. Fechas: <code className="rounded bg-slate-100 px-1">DD/MM/AAAA</code> o{" "}
        <code className="rounded bg-slate-100 px-1">AAAA-MM-DD</code>.
        <span className="mt-2 block text-amber-800">
          El Excel <code className="rounded bg-amber-100 px-1">consumers-*.csv.xlsx</code> de DrApp
          es solo pacientes →{" "}
          <Link href="/pacientes" className="font-medium text-blue-700 hover:underline">
            importalo en Pacientes
          </Link>
          , no acá.
        </span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void processFile(file);
          }}
        />
        <Button type="button" variant="outline" loading={importing} onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4" />
          Subir CSV
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="h-4 w-4" />
          Descargar plantilla
        </Button>
      </div>

      {importing && (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Importando consultas…
        </p>
      )}

      {error && (
        <div className="mt-3 text-sm text-red-600" role="alert">
          <p>{error}</p>
          {(error.includes("Pacientes") || error.includes("consumers")) && (
            <Link href="/pacientes" className="mt-2 inline-block font-medium text-blue-700 hover:underline">
              Ir a Pacientes → Importar Excel DrApp
            </Link>
          )}
        </div>
      )}

      {result?.success && !importing && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
          <p className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {result.fileName}
          </p>
          <p className="mt-1">
            {result.recordsCreated} consulta(s) creada(s)
            {result.recordsSkipped > 0 ? ` · ${result.recordsSkipped} omitida(s) (ya importadas)` : ""}
            {result.patientsCreated > 0 ? ` · ${result.patientsCreated} paciente(s) nuevo(s)` : ""}
          </p>
          {result.parseErrors.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-amber-900">
              {result.parseErrors.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {result && !result.success && !importing && !error && (
        <p className="mt-3 flex items-center gap-2 text-sm text-red-600">
          <XCircle className="h-4 w-4" />
          {result.error}
        </p>
      )}

      {!importing && !result && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-sm text-slate-500">
          <FileSpreadsheet className="h-5 w-5 shrink-0" />
          Exportá desde Excel o DrApp a CSV y subilo acá.
        </div>
      )}
    </Card>
  );
}
