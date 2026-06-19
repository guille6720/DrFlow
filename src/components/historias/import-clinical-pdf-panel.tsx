"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CLINICAL_DOCUMENT_MAX_BYTES,
  CLINICAL_PDF_IMPORT_MAX_FILES,
} from "@/lib/constants/clinical-documents";
import { importClinicalPdfDocument, type ImportClinicalPdfResult } from "@/lib/actions/patient-attachments";
import { CheckCircle2, FileUp, Loader2, Upload, XCircle } from "lucide-react";

interface Props {
  canImport: boolean;
}

type ResultRow = ImportClinicalPdfResult & { id: string };

export function ImportClinicalPdfPanel({ canImport }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<ResultRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  if (!canImport) return null;

  async function processFiles(files: FileList | File[]) {
    const list = Array.from(files).filter(
      (file) =>
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    );

    if (list.length === 0) {
      setError("Seleccioná al menos un archivo PDF.");
      return;
    }

    if (list.length > CLINICAL_PDF_IMPORT_MAX_FILES) {
      setError(`Podés importar hasta ${CLINICAL_PDF_IMPORT_MAX_FILES} PDFs por vez.`);
      return;
    }

    const oversized = list.find((file) => file.size > CLINICAL_DOCUMENT_MAX_BYTES);
    if (oversized) {
      setError(`"${oversized.name}" supera el límite de 10 MB.`);
      return;
    }

    setImporting(true);
    setError(null);
    setResults([]);
    setProgress({ current: 0, total: list.length });

    const batchResults: ResultRow[] = [];

    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      setProgress({ current: i + 1, total: list.length });
      const formData = new FormData();
      formData.set("file", file);
      const result = await importClinicalPdfDocument(formData);
      batchResults.push({ ...result, id: `${file.name}-${i}` });
      setResults([...batchResults]);
    }

    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    router.refresh();
  }

  const successCount = results.filter((row) => row.success).length;
  const createdCount = results.filter((row) => row.success && row.patientCreated).length;

  return (
    <Card title="Importar historias PDF">
      <p className="mb-3 text-sm text-slate-600">
        Subí historias exportadas desde otra app, de a una o en lote. DrFlow detecta el DNI en el
        PDF o en el nombre del archivo y crea el paciente automáticamente si no existe.
      </p>
      <p className="mb-4 text-xs text-slate-500">
        Tip: renombrá los archivos como{" "}
        <code className="rounded bg-slate-100 px-1">APELLIDO_Nombre_12345678.pdf</code> si el PDF
        no trae datos legibles.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = e.target.files;
            if (files?.length) void processFiles(files);
          }}
        />
        <Button
          type="button"
          variant="outline"
          loading={importing}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          Elegir PDFs
        </Button>
        <span className="text-xs text-slate-500">
          Hasta {CLINICAL_PDF_IMPORT_MAX_FILES} archivos · 10 MB c/u
        </span>
      </div>

      {importing && (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Importando {progress.current} de {progress.total}…
        </p>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {results.length > 0 && !importing && (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-slate-800">
            {successCount} de {results.length} importados
            {createdCount > 0 ? ` · ${createdCount} paciente(s) nuevo(s)` : ""}
          </p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {results.map((row) => (
              <li key={row.id} className="flex items-start gap-3 px-3 py-3 text-sm">
                {row.success ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{row.fileName}</p>
                  {row.success ? (
                    <>
                      <p className="text-slate-600">
                        {row.patientName} · DNI {row.documentNumber}
                        {row.patientCreated ? " · paciente creado" : " · paciente existente"}
                      </p>
                      <Link
                        href={`/pacientes/${row.patientId}`}
                        className="text-blue-700 hover:underline"
                      >
                        Ver ficha del paciente
                      </Link>
                    </>
                  ) : (
                    <p className="text-red-700">{row.error}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!importing && results.length === 0 && (
        <div
          className={`mt-4 flex items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-sm transition-colors ${
            dragging
              ? "border-blue-400 bg-blue-50 text-blue-700"
              : "border-slate-200 bg-slate-50/80 text-slate-500"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files.length) void processFiles(e.dataTransfer.files);
          }}
        >
          <FileUp className="h-5 w-5 shrink-0" />
          Arrastrá PDFs acá o usá el botón para seleccionarlos.
        </div>
      )}

      {!importing && results.length > 0 && (
        <div className="mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setResults([]);
              fileInputRef.current?.click();
            }}
          >
            Importar más PDFs
          </Button>
        </div>
      )}
    </Card>
  );
}
