"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HCE_EXPORT_MAX_BYTES } from "@/lib/constants/clinical-documents";
import { importHceExportCsv, type ImportHceExportResult } from "@/lib/actions/hce-import";
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";

interface Props {
  canImport: boolean;
}

export function ImportHceExportPanel({ canImport }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<{
    fileName: string;
    recordsCreated: number;
    recordsSkipped: number;
    patientsCreated: number;
    attachmentsCreated: number;
    parseErrors: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canImport) return null;

  async function processFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Subí el archivo HCE_export.csv.");
      return;
    }
    if (file.size > HCE_EXPORT_MAX_BYTES) {
      setError("El archivo supera 15 MB.");
      return;
    }

    setImporting(true);
    setError(null);
    setSummary(null);
    setProgress({ done: 0, total: 0 });

    const totals = {
      fileName: file.name,
      recordsCreated: 0,
      recordsSkipped: 0,
      patientsCreated: 0,
      attachmentsCreated: 0,
      parseErrors: [] as string[],
    };

    let offset = 0;
    let hasMore = true;

    try {
      while (hasMore) {
        const formData = new FormData();
        formData.set("file", file);
        formData.set("offset", String(offset));
        const result: ImportHceExportResult = await importHceExportCsv(formData);
        if (!result.success) {
          setError(result.error);
          break;
        }
        totals.recordsCreated += result.recordsCreated;
        totals.recordsSkipped += result.recordsSkipped;
        totals.patientsCreated += result.patientsCreated;
        totals.attachmentsCreated += result.attachmentsCreated;
        if (offset === 0) totals.parseErrors = result.parseErrors;
        setProgress({ done: result.processedThrough, total: result.totalRecords });
        setSummary({ ...totals });
        hasMore = result.hasMore;
        offset = result.nextOffset;
      }
    } catch {
      setError("Error de conexión durante la importación HCE.");
    }

    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    router.refresh();
  }

  return (
    <Card title="Importar export HCE (CSV)">
      <p className="mb-3 text-sm text-slate-600">
        Subí <code className="rounded bg-slate-100 px-1">HCE_export.csv</code>: crea pacientes si
        no existen (por ID de importación o nombre), registra diagnósticos/tratamientos y deja en cada ficha
        un CSV descargable con su resumen HCE.
      </p>
      <p className="mb-4 text-xs text-slate-500">
        Recomendado importar antes{" "}
        <Link href="/pacientes" className="text-blue-700 hover:underline">
          pacientes consumers
        </Link>{" "}
        para vincular DNI reales. Sin DNI se genera uno interno 90xxxxxxx.
      </p>

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
      <Button
        type="button"
        variant="outline"
        loading={importing}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-4 w-4" />
        Subir HCE_export.csv
      </Button>

      {importing && (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          {progress.total > 0
            ? `Procesando ${progress.done} de ${progress.total} filas…`
            : "Procesando export HCE…"}
        </p>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {summary && !importing && !error && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
          <p className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {summary.fileName}
          </p>
          <p className="mt-1">
            {summary.patientsCreated} paciente(s) nuevo(s) · {summary.recordsCreated} registro(s) HCE
            · {summary.attachmentsCreated} resumen(es) CSV en fichas · {summary.recordsSkipped}{" "}
            omitidos (duplicados)
          </p>
          <p className="mt-2 text-xs">
            En cada paciente: Documentos clínicos →{" "}
            <Download className="inline h-3 w-3" />{" "}
            <strong>hce-export-resumen.csv</strong>
          </p>
          {summary.parseErrors.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-amber-900">
              {summary.parseErrors.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!importing && !summary && !error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-sm text-slate-500">
          <FileSpreadsheet className="h-5 w-5 shrink-0" />
          Subí tu export HCE acá.
        </div>
      )}
    </Card>
  );
}
