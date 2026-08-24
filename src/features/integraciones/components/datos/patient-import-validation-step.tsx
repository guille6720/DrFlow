"use client";

import type { DataImportSessionRow } from "@/features/integraciones/server/data-import-types";

import { Button } from "@/components/ui/button";

type Props = {
  session: DataImportSessionRow;
  busy: boolean;
  onNext: () => void;
  onErrors: () => void;
};

export function PatientImportValidationStep({ session, busy, onNext, onErrors }: Props) {
  const stats = session.stats;
  const shown = session.invalid_sample.length;
  return (
    <div className="space-y-3">
      <ul className="grid gap-2 text-sm sm:grid-cols-2">
        <li>Total: {stats.total}</li>
        <li>Listos para importar: {stats.ready}</li>
        <li>Posibles duplicados: {stats.duplicates}</li>
        <li>Inválidos: {stats.invalid}</li>
      </ul>
      {shown > 0 ? (
        <>
          <p className="text-xs text-slate-500">
            Mostrando {shown} de {stats.invalid} errores. El CSV incluye la muestra guardada.
          </p>
          <ul className="max-h-48 overflow-auto rounded-lg border border-slate-200 p-2 text-xs text-slate-700">
            {session.invalid_sample.map((issue) => (
              <li key={`${issue.lineNumber}-${issue.code}`}>{issue.message}</li>
            ))}
          </ul>
        </>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onErrors}>
          Descargar errores
        </Button>
        <Button type="button" loading={busy} onClick={onNext}>
          Continuar
        </Button>
      </div>
    </div>
  );
}
