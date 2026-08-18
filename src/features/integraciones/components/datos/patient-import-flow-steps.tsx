"use client";

import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import type { RefObject } from "react";

import { ImportJobsQueuedBanner } from "@/features/integraciones/components/datos/import-jobs-queued-banner";
import type { DataImportSessionRow } from "@/features/integraciones/server/data-import-types";

import { Button } from "@/components/ui/button";

export function PatientImportUploadStep({
  fileRef,
  accept,
  busy,
  onPick,
}: {
  fileRef: RefObject<HTMLInputElement | null>;
  accept: string;
  busy: boolean;
  onPick: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Subí un .xlsx o .csv. No se escribe en la base hasta que confirmes el último paso.
      </p>
      <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={onPick} />
      <Button type="button" variant="outline" loading={busy} onClick={() => fileRef.current?.click()}>
        <Upload className="h-4 w-4" />
        Subir planilla
      </Button>
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
        <FileSpreadsheet className="h-5 w-5" />
        Hasta 5000 filas · 15 MB · sin macros ni fórmulas.
      </div>
    </div>
  );
}

export function PatientImportConfirmStep({
  session,
  busy,
  onConfirm,
}: {
  session: DataImportSessionRow;
  busy: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-900">Listo para importar</p>
      <ul className="text-sm text-slate-700">
        <li>Total: {session.stats.total}</li>
        <li>Listos: {session.stats.ready}</li>
        <li>Posibles duplicados: {session.stats.duplicates}</li>
        <li>Inválidos (no se importan): {session.stats.invalid}</li>
      </ul>
      <p className="text-xs text-amber-800">
        La importación escribe pacientes de este consultorio. No reemplaza consultas ni HC firmada.
      </p>
      <Button type="button" loading={busy} onClick={onConfirm}>
        Confirmar importación
      </Button>
    </div>
  );
}

export function PatientImportStepper({
  steps,
  current,
}: {
  steps: readonly string[];
  current: number;
}) {
  return (
    <ol className="flex flex-wrap gap-2 text-xs font-medium">
      {steps.map((label, index) => (
        <li
          key={label}
          className={
            index === current
              ? "rounded-full bg-teal-700 px-2.5 py-1 text-white"
              : index < current
                ? "rounded-full bg-teal-100 px-2.5 py-1 text-teal-900"
                : "rounded-full bg-slate-100 px-2.5 py-1 text-slate-600"
          }
        >
          {index + 1}. {label}
        </li>
      ))}
    </ol>
  );
}

export function PatientImportStatus({ busy, error }: { busy: boolean; error: string | null }) {
  return (
    <>
      {busy ? (
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Procesando en el servidor…
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

export function PatientImportResultStep({
  session,
  jobId,
}: {
  session: DataImportSessionRow | null;
  jobId: string | null;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-900">Importación en cola</p>
      <p className="text-sm text-slate-600">
        Estado: {session?.status ?? "importing"}. El detalle final queda en el historial cuando termina el
        lote.
      </p>
      {jobId ? <ImportJobsQueuedBanner enqueued={1} jobIds={[jobId]} /> : null}
    </div>
  );
}
