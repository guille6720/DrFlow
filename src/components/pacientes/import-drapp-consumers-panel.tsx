"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DRAPP_CONSUMERS_MAX_BYTES } from "@/lib/constants/clinical-documents";
import {
  importDrAppConsumersFile,
  type ImportDrAppConsumersResult,
} from "@/lib/actions/patient-import";
import { CheckCircle2, FileSpreadsheet, Loader2, Upload, XCircle } from "lucide-react";

interface Props {
  canImport: boolean;
}

const ACCEPT = ".xlsx,.xls,.csv,.csv.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function ImportDrAppConsumersPanel({ canImport }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportDrAppConsumersResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canImport) return null;

  async function processFile(file: File) {
    const lower = file.name.toLowerCase();
    const ok =
      lower.endsWith(".xlsx") ||
      lower.endsWith(".xls") ||
      lower.endsWith(".csv") ||
      lower.endsWith(".csv.xlsx");
    if (!ok) {
      setError("Formato no soportado. Usá el export DrApp (.xlsx o .csv.xlsx).");
      return;
    }
    if (file.size > DRAPP_CONSUMERS_MAX_BYTES) {
      setError("El archivo supera 15 MB.");
      return;
    }

    setImporting(true);
    setError(null);
    setResult(null);
    const formData = new FormData();
    formData.set("file", file);
    const importResult = await importDrAppConsumersFile(formData);
    setResult(importResult);
    if (!importResult.success) setError(importResult.error);
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    router.refresh();
  }

  return (
    <Card title="Importar pacientes DrApp (Excel)">
      <p className="mb-3 text-sm text-slate-600">
        Subí el export de residentes/pacientes de DrApp, por ejemplo{" "}
        <code className="rounded bg-slate-100 px-1">consumers-*.csv.xlsx</code>. DrFlow lee DNI,
        nombre, fecha de nacimiento, teléfono, email y PAMI desde cada fila.
      </p>
      <p className="mb-4 text-xs text-slate-500">
        Hasta 5000 filas · 15 MB. Si el paciente ya existe (mismo DNI), se completan datos vacíos sin
        pisar lo que ya tenés cargado.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
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
        Subir Excel DrApp
      </Button>

      {importing && (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Importando pacientes…
        </p>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {result?.success && !importing && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
          <p className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {result.fileName}
          </p>
          <p className="mt-1">
            {result.patientsCreated} paciente(s) nuevo(s) · {result.patientsUpdated} actualizado(s) ·{" "}
            {result.patientsSkipped} sin cambios
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
          Arrastrá o elegí tu archivo consumers de DrApp.
        </div>
      )}
    </Card>
  );
}
