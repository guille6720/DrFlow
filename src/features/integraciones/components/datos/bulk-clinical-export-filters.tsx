"use client";

import { useCanUseFeature } from "@/core/components/entitlements/entitlements-provider";
import { FEATURES } from "@/core/entitlements/features";

import type { BulkClinicalExportFormat } from "@/features/integraciones/lib/bulk-clinical-export";
import {
  ALL_CLINICAL_EXPORT_SECTIONS,
  CLINICAL_EXPORT_SECTIONS,
  type ClinicalExportSection,
} from "@/features/integraciones/lib/clinical-export-sections";
import { PatientSearchCombobox } from "@/features/pacientes/components/pacientes/patient-search-combobox";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export type BulkExportDraft = {
  format: BulkClinicalExportFormat;
  scope: "all" | "selected";
  patientIds: string[];
  patientLabels: Record<string, string>;
  rangeMode: "all" | "custom";
  dateFrom: string;
  dateTo: string;
  professionalId: string;
  insuranceProvider: string;
  sections: ClinicalExportSection[];
};

export const EMPTY_BULK_EXPORT_DRAFT: BulkExportDraft = {
  format: "json",
  scope: "all",
  patientIds: [],
  patientLabels: {},
  rangeMode: "all",
  dateFrom: "",
  dateTo: "",
  professionalId: "",
  insuranceProvider: "",
  sections: [...ALL_CLINICAL_EXPORT_SECTIONS],
};

type Props = {
  draft: BulkExportDraft;
  onChange: (draft: BulkExportDraft) => void;
  professionals: Array<{ id: string; name: string }>;
  insuranceOptions: string[];
};

export function BulkClinicalExportFilters({ draft, onChange, professionals, insuranceOptions }: Props) {
  const canExportFhir = useCanUseFeature(FEATURES.INTEGRATIONS);
  function patch(partial: Partial<BulkExportDraft>) {
    onChange({ ...draft, ...partial });
  }

  return (
    <div className="space-y-3">
      <Select
        label="Alcance"
        value={draft.scope}
        onChange={(event) => patch({ scope: event.target.value as "all" | "selected" })}
        options={[
          { value: "all", label: "Todos los pacientes activos" },
          { value: "selected", label: "Pacientes seleccionados" },
        ]}
      />
      {draft.scope === "selected" ? (
        <div className="space-y-2">
          <PatientSearchCombobox
            patients={[]}
            label="Agregar paciente"
            searchMode="remote"
            displayMode="detailed"
            onPatientChange={(id, patient) => {
              if (!id || draft.patientIds.includes(id)) return;
              patch({
                patientIds: [...draft.patientIds, id],
                patientLabels: {
                  ...draft.patientLabels,
                  [id]: patient
                    ? `${patient.last_name}, ${patient.first_name} · DNI ${patient.document_number}`
                    : id.slice(0, 8),
                },
              });
            }}
          />
          {draft.patientIds.length > 0 ? (
            <ul className="space-y-1 text-sm text-slate-700">
              {draft.patientIds.map((id) => (
                <li key={id} className="flex items-center justify-between gap-2">
                  <span>{draft.patientLabels[id] ?? id.slice(0, 8)}</span>
                  <button
                    type="button"
                    className="text-teal-800 underline"
                    onClick={() => patch({ patientIds: draft.patientIds.filter((value) => value !== id) })}
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <Select
        label="Formato"
        value={draft.format}
        onChange={(event) => patch({ format: event.target.value as BulkClinicalExportFormat })}
        options={[
          { value: "csv", label: "CSV" },
          { value: "xlsx", label: "Excel" },
          { value: "json", label: "JSON estructurado" },
          ...(canExportFhir ? [{ value: "fhir" as const, label: "FHIR R4" }] : []),
          { value: "zip", label: "ZIP completo" },
        ]}
      />
      <Select
        label="Rango de fechas"
        value={draft.rangeMode}
        onChange={(event) => patch({ rangeMode: event.target.value as "all" | "custom" })}
        options={[
          { value: "all", label: "Todas las fechas" },
          { value: "custom", label: "Rango personalizado" },
        ]}
      />
      {draft.rangeMode === "custom" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input label="Desde" type="date" value={draft.dateFrom} onChange={(event) => patch({ dateFrom: event.target.value })} />
          <Input label="Hasta" type="date" value={draft.dateTo} onChange={(event) => patch({ dateTo: event.target.value })} />
        </div>
      ) : null}
      <Select
        label="Profesional (opcional)"
        value={draft.professionalId}
        onChange={(event) => patch({ professionalId: event.target.value })}
        options={[
          { value: "", label: "Todos" },
          ...professionals.map((item) => ({ value: item.id, label: item.name })),
        ]}
      />
      <Select
        label="Cobertura (opcional)"
        value={draft.insuranceProvider}
        onChange={(event) => patch({ insuranceProvider: event.target.value })}
        options={[
          { value: "", label: "Todas" },
          ...insuranceOptions.map((item) => ({ value: item, label: item })),
        ]}
      />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-800">Información a incluir</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {CLINICAL_EXPORT_SECTIONS.map((item) => (
            <label key={item.id} className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={draft.sections.includes(item.id)}
                onChange={(event) => {
                  patch({
                    sections: event.target.checked
                      ? [...draft.sections, item.id]
                      : draft.sections.filter((value) => value !== item.id),
                  });
                }}
              />
              {item.label}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
