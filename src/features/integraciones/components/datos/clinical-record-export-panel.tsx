"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import { AddonUpgradeNotice } from "@/core/components/entitlements/addon-upgrade-notice";
import { useCanUseFeature } from "@/core/components/entitlements/entitlements-provider";
import { FEATURES } from "@/core/entitlements/features";

import {
  type ClinicalExportFormat,
  exportPatientClinicalPackage,
} from "@/features/integraciones/actions/patient-clinical-export";
import {
  downloadBase64File,
  downloadFromUrl,
} from "@/features/integraciones/components/datos/download-file";
import {
  ALL_CLINICAL_EXPORT_SECTIONS,
  CLINICAL_EXPORT_SECTIONS,
  type ClinicalExportSection,
} from "@/features/integraciones/lib/clinical-export-sections";
import { PatientSearchCombobox } from "@/features/pacientes/components/pacientes/patient-search-combobox";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Props = { canExport: boolean };

export function ClinicalRecordExportPanel({ canExport }: Props) {
  const canExportPdf = useCanUseFeature(FEATURES.PDF_EXPORT);
  const canExportFhir = useCanUseFeature(FEATURES.INTEGRATIONS);
  const [patientId, setPatientId] = useState("");
  const [format, setFormat] = useState<ClinicalExportFormat>("json");
  const [rangeMode, setRangeMode] = useState<"all" | "custom">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sections, setSections] = useState<ClinicalExportSection[]>([...ALL_CLINICAL_EXPORT_SECTIONS]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canExport) {
    return <p className="text-sm text-slate-600">No tenés permiso para exportar historias clínicas.</p>;
  }

  async function runExport() {
    setBusy(true);
    setError(null);
    const result = await exportPatientClinicalPackage({
      patientId,
      format,
      sections,
      dateFrom: rangeMode === "custom" ? dateFrom : null,
      dateTo: rangeMode === "custom" ? dateTo : null,
    });
    setBusy(false);
    if (result.error || !result.fileName) {
      setError(result.error ?? "No se pudo generar la exportación.");
      return;
    }
    if (result.url) {
      await downloadFromUrl(result.fileName, result.url);
      return;
    }
    if (result.base64 && result.mime) {
      downloadBase64File(result.fileName, result.mime, result.base64);
    }
  }

  return (
    <div className="space-y-3">
      {!canExportPdf ? <AddonUpgradeNotice feature={FEATURES.PDF_EXPORT} /> : null}
      {!canExportFhir ? <AddonUpgradeNotice feature={FEATURES.INTEGRATIONS} /> : null}
      <p className="text-sm text-slate-600">
        JSON estructurado, FHIR R4, PDF resumido o ZIP con HC, datos, adjuntos y carpeta FHIR/.
      </p>
      <PatientSearchCombobox
        patients={[]}
        label="Paciente"
        required
        searchMode="remote"
        displayMode="detailed"
        onPatientChange={(id) => setPatientId(id)}
      />
      <Select
        label="Formato"
        value={format}
        onChange={(event) => setFormat(event.target.value as ClinicalExportFormat)}
        options={[
          { value: "json", label: "JSON estructurado" },
          ...(canExportFhir ? [{ value: "fhir", label: "FHIR R4 (Bundle)" }] : []),
          ...(canExportPdf ? [{ value: "pdf", label: "PDF resumido" }] : []),
          { value: "zip", label: "ZIP completo" },
        ]}
      />
      <Select
        label="Rango de fechas"
        value={rangeMode}
        onChange={(event) => setRangeMode(event.target.value as "all" | "custom")}
        options={[
          { value: "all", label: "Todas las fechas" },
          { value: "custom", label: "Rango personalizado" },
        ]}
      />
      {rangeMode === "custom" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input label="Desde" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <Input label="Hasta" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </div>
      ) : null}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-800">Secciones</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {CLINICAL_EXPORT_SECTIONS.map((item) => (
            <label key={item.id} className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={sections.includes(item.id)}
                onChange={(event) => {
                  setSections((current) =>
                    event.target.checked
                      ? [...current, item.id]
                      : current.filter((value) => value !== item.id)
                  );
                }}
              />
              {item.label}
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="button" loading={busy} disabled={!patientId || sections.length === 0} onClick={() => void runExport()}>
        <Download className="h-4 w-4" />
        Exportar
      </Button>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
