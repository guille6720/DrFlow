"use client";

import {
  type DuplicateDecision,
  type DuplicateDecisionSet,
  type PatientDuplicateCandidate,
} from "@/features/integraciones/lib/patient-import-duplicates";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type Props = {
  duplicates: PatientDuplicateCandidate[];
  totalDuplicates: number;
  decisions: DuplicateDecisionSet;
  busy: boolean;
  onChange: (decisions: DuplicateDecisionSet) => void;
  onNext: () => void;
};

export function PatientImportDuplicatesStep({
  duplicates,
  totalDuplicates,
  decisions,
  busy,
  onChange,
  onNext,
}: Props) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Los duplicados no se pisan solos. Elegí qué hacer con coincidencias exactas de DNI y con
        posibles (nombre + fecha).
      </p>
      <Select
        label="Coincidencia exacta (mismo DNI)"
        value={decisions.exactDefault}
        onChange={(event) =>
          onChange({ ...decisions, exactDefault: event.target.value as DuplicateDecision })
        }
        options={[
          { value: "keep", label: "Conservar el existente" },
          { value: "update", label: "Actualizar datos demográficos vacíos" },
          { value: "skip", label: "Omitir" },
          { value: "review", label: "Revisar después" },
        ]}
      />
      <Select
        label="Posible duplicado (nombre + nacimiento)"
        value={decisions.possibleDefault}
        onChange={(event) =>
          onChange({
            ...decisions,
            possibleDefault: event.target.value as DuplicateDecision,
          })
        }
        options={[
          { value: "review", label: "Revisar manualmente (no importar aún)" },
          { value: "create", label: "Crear como paciente nuevo" },
          { value: "skip", label: "Omitir" },
          { value: "update", label: "Actualizar demográficos vacíos" },
        ]}
      />
      <p className="text-xs text-slate-500">
        Mostrando {duplicates.length} de {totalDuplicates} coincidencias.
      </p>
      <ul className="max-h-64 space-y-2 overflow-auto text-sm">
        {duplicates.map((item) => (
          <li key={item.lineNumber} className="rounded-lg border border-slate-200 p-2">
            <p className="font-medium text-slate-900">
              Fila {item.lineNumber} · {item.matchType === "document" ? "DNI exacto" : "nombre + fecha"}
            </p>
            <p className="text-slate-600">
              Existente: {item.existing.last_name}, {item.existing.first_name} (
              {item.existing.document_number})
            </p>
            <p className="text-slate-600">
              Entrante: {item.incoming.last_name}, {item.incoming.first_name} (
              {item.incoming.document_number})
            </p>
          </li>
        ))}
      </ul>
      <Button type="button" loading={busy} onClick={onNext}>
        Continuar
      </Button>
    </div>
  );
}
