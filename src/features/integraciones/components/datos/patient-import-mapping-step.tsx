"use client";

import {
  BUILTIN_MAPPING_PRESETS,
  PATIENT_IMPORT_FIELD_LABELS,
  PATIENT_IMPORT_FIELDS,
  type PatientColumnMapping,
} from "@/features/integraciones/lib/patient-import-mapping";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type TemplateOption = { id: string; name: string; mapping: PatientColumnMapping };

type Props = {
  fileName: string;
  total: number;
  appliedTemplateName: string | null;
  templates: TemplateOption[];
  mapping: PatientColumnMapping;
  dateFormat: string;
  headerOptions: Array<{ value: string; label: string }>;
  templateName: string;
  busy: boolean;
  onMappingChange: (mapping: PatientColumnMapping) => void;
  onDateFormatChange: (value: string) => void;
  onTemplateNameChange: (value: string) => void;
  onApplyTemplate: (template: TemplateOption) => void;
  onSaveTemplate: () => void;
  onValidate: () => void;
};

export function PatientImportMappingStep({
  fileName,
  total,
  appliedTemplateName,
  templates,
  mapping,
  dateFormat,
  headerOptions,
  templateName,
  busy,
  onMappingChange,
  onDateFormatChange,
  onTemplateNameChange,
  onApplyTemplate,
  onSaveTemplate,
  onValidate,
}: Props) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Archivo: {fileName} · {total} filas. Ajustá el mapeo si hace falta.
      </p>
      {appliedTemplateName ? (
        <p className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-950">
          Se aplicó la plantilla <strong>{appliedTemplateName}</strong>. Podés cambiar cualquier
          columna.
        </p>
      ) : null}
      <Select
        label="Plantilla"
        value=""
        onChange={(event) => {
          const chosen = templates.find((item) => item.id === event.target.value);
          if (chosen) onApplyTemplate(chosen);
        }}
        options={[
          { value: "", label: "Sugerido automáticamente" },
          ...templates.map((item) => ({ value: item.id, label: item.name })),
          ...BUILTIN_MAPPING_PRESETS.map((item) => ({
            value: `builtin-${item.id}`,
            label: `${item.name} (nombres de columna)`,
          })),
        ]}
      />
      <Select
        label="Formato de fecha"
        value={dateFormat}
        onChange={(event) => onDateFormatChange(event.target.value)}
        options={[
          { value: "dmy", label: "Día/Mes/Año" },
          { value: "mdy", label: "Mes/Día/Año" },
        ]}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        {PATIENT_IMPORT_FIELDS.map((field) => (
          <Select
            key={field}
            label={PATIENT_IMPORT_FIELD_LABELS[field]}
            value={mapping[field] ?? ""}
            onChange={(event) =>
              onMappingChange({ ...mapping, [field]: event.target.value || undefined })
            }
            options={headerOptions}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Input
          label="Guardar plantilla"
          value={templateName}
          onChange={(event) => onTemplateNameChange(event.target.value)}
          placeholder="PAMI, OSDE, planilla propia…"
        />
        <Button type="button" variant="outline" onClick={onSaveTemplate}>
          Guardar mapeo
        </Button>
        <Button type="button" loading={busy} onClick={onValidate}>
          Validar filas
        </Button>
      </div>
    </div>
  );
}
