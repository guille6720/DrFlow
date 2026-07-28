"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PanelShell } from "@/components/ui/panel-shell";
import { Button } from "@/components/ui/button";
import {
  TEAMS_JSONL_IMPORT_BATCH_SIZE,
  TEAMS_JSONL_MAX_BYTES,
} from "@/lib/constants/clinical-documents";
import {
  importTeamsJsonlBatch,
  type ImportTeamsJsonlBatchResult,
} from "@/lib/actions/teams-jsonl-import";
import { parseTeamsJsonlContent, isTeamsJsonlFile } from "@/lib/utils/teams-jsonl-parse";
import { CheckCircle2, Loader2, Upload } from "lucide-react";

interface Props {
  canImport: boolean;
  embedded?: boolean;
}

export function ImportTeamsJsonlPanel({ canImport, embedded }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<{
    fileName: string;
    recordsCreated: number;
    recordsSkipped: number;
    patientsCreated: number;
    parseErrors: string[];
    stats?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canImport) return null;

  async function processFile(file: File) {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".jsonl")) {
      setError("Subí un archivo teams-*.jsonl (export JSONL por línea).");
      return;
    }
    if (file.size > TEAMS_JSONL_MAX_BYTES) {
      setError("El archivo supera 55 MB.");
      return;
    }

    setImporting(true);
    setError(null);
    setSummary(null);
    setProgress({ done: 0, total: 0 });

    try {
      const content = await file.text();
      const sample = content.slice(0, 500);
      if (!isTeamsJsonlFile(file.name, sample)) {
        setError("No parece un export teams válido (JSONL por línea).");
        setImporting(false);
        return;
      }

      const { rows, errors, stats } = parseTeamsJsonlContent(content);
      if (rows.length === 0) {
        setError(errors[0] ?? "No hay registros clínicos en el archivo.");
        setImporting(false);
        return;
      }

      const totals = {
        fileName: file.name,
        recordsCreated: 0,
        recordsSkipped: 0,
        patientsCreated: 0,
        parseErrors: [...errors],
        stats: `${stats.recordsParsed} registros · ${stats.consumers} pacientes en el dump · ${stats.recordsSkipped} omitidos`,
      };

      setProgress({ done: 0, total: rows.length });

      let offset = 0;
      while (offset < rows.length) {
        const slice = rows.slice(offset, offset + TEAMS_JSONL_IMPORT_BATCH_SIZE);
        const formData = new FormData();
        formData.set("fileName", file.name);
        formData.set("totalRecords", String(rows.length));
        formData.set("offset", String(offset));
        formData.set("payload", JSON.stringify(slice));

        const result: ImportTeamsJsonlBatchResult = await importTeamsJsonlBatch(formData);
        if (!result.success) {
          setError(result.error);
          setSummary({ ...totals });
          break;
        }

        totals.recordsCreated += result.recordsCreated;
        totals.recordsSkipped += result.recordsSkipped;
        totals.patientsCreated += result.patientsCreated;
        totals.parseErrors.push(...result.parseErrors);
        setProgress({ done: result.processedThrough, total: rows.length });
        setSummary({ ...totals });
        offset = result.nextOffset;
      }

      router.refresh();
    } catch {
      setError("No se pudo leer el JSONL. Probá de nuevo en Chrome o Edge.");
    } finally {
      setImporting(false);
    }
  }

  const shell = (
    <div className="space-y-3">
      <p className="text-xs text-slate-600">
        Export JSONL de equipo (<code className="text-[11px]">teams-….jsonl</code>): diagnósticos,
        tratamientos, evoluciones, signos vitales y referencias a archivos. Parsea en el navegador y
        sube por lotes (no hace falta volver a elegir el archivo).
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept=".jsonl,application/jsonl"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void processFile(f);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        disabled={importing}
        onClick={() => fileInputRef.current?.click()}
      >
        {importing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {importing ? "Importando…" : "Elegir teams JSONL"}
      </Button>

      {importing && progress.total > 0 && (
        <p className="text-xs text-slate-600">
          {progress.done} / {progress.total} registros procesados…
        </p>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}

      {summary && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-sm text-emerald-950">
          <p className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {summary.fileName}
          </p>
          {summary.stats && <p className="mt-1 text-xs text-emerald-900/90">{summary.stats}</p>}
          <ul className="mt-2 list-inside list-disc text-xs">
            <li>{summary.recordsCreated} consultas nuevas</li>
            <li>{summary.recordsSkipped} ya existían (mismo id de importación)</li>
            <li>{summary.patientsCreated} pacientes creados</li>
          </ul>
          {summary.parseErrors.length > 0 && (
            <details className="mt-2 text-xs text-amber-900">
              <summary>Avisos ({summary.parseErrors.length})</summary>
              <ul className="mt-1 max-h-32 overflow-y-auto">
                {summary.parseErrors.slice(0, 15).map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );

  if (embedded) {
    return shell;
  }

  return (
    <PanelShell title="Importar teams JSONL">
      {shell}
    </PanelShell>
  );
}
