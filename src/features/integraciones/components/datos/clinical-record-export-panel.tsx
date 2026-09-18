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
import {
  PatientSearchCombobox,
  type PatientSearchOption,
} from "@/features/pacientes/components/pacientes/patient-search-combobox";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Props = { canExport: boolean };

export function ClinicalRecordExportPanel({ canExport }: Props) {
  const canExportPdf = useCanUseFeature(FEATURES.PDF_EXPORT);
  const canExportFhir = useCanUseFeature(FEATURES.INTEGRATIONS);
  const [patientId, setPatientId] = useState("");
  const [patientLabel, setPatientLabel] = useState<string | null>(null);
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

  function handlePatientChange(id: string, patient?: PatientSearchOption) {
    setPatientId(id);
    setPatientLabel(
      id && patient ? `${patient.last_name}, ${patient.first_name} · DNI ${patient.document_number}` : null
    );
    setError(null);
  }

  async function runExport() {
    setError(null);
    if (!patientId) {
      setError("Buscá y seleccioná un paciente de la lista antes de exportar.");
      return;
    }
    if (sections.length === 0) {
      setError("Elegí al menos una sección para exportar.");
      return;
    }

    setBusy(true);
    try {
      const result = await exportPatientClinicalPackage({
        patientId,
        format,
        sections,
        dateFrom: rangeMode === "custom" ? dateFrom : null,
        dateTo: rangeMode === "custom" ? dateTo : null,
      });
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
        return;
      }
      setError("La exportación no devolvió un archivo descargable.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo descargar el archivo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {!canExportPdf ? <AddonUpgradeNotice feature={FEATURES.PDF_EXPORT} /> : null}
      {!canExportFhir ? <AddonUpgradeNotice feature={FEATURES.INTEGRATIONS} /> : null}
      <p className="text-sm text-slate-600">
        Exportá la historia de <strong className="font-semibold text-slate-800">un paciente</strong>{" "}
        en JSON estructurado, FHIR R4, PDF resumido o ZIP con adjuntos. Escribí nombre o DNI, elegí el
        resultado de la lista y después tocá Exportar.
      </p>
      <PatientSearchCombobox
        patients={[]}
        label="Paciente"
        required
        searchMode="remote"
        displayMode="detailed"
        onPatientChange={handlePatientChange}
      />
      {patientLabel ? (
        <p className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
          Paciente seleccionado: <span className="font-semibold">{patientLabel}</span>
        </p>
      ) : (
        <p className="text-xs text-amber-800">
          El botón Exportar se habilita cuando seleccionás un paciente de los resultados de búsqueda.
        </p>
      )}
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
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          loading={busy}
          disabled={sections.length === 0}
          onClick={() => void runExport()}
        >
          <Download className="h-4 w-4" />
          Exportar
        </Button>
        {!patientId ? (
          <span className="text-xs text-slate-600">Falta seleccionar paciente</span>
        ) : null}
      </div>
      <p className="text-xs text-slate-500">
        ¿Querés exportar <strong className="font-medium">todas</strong> las historias de la clínica?
        Usá{" "}
        <a
          href="/datos?flujo=export-masivo&formato=json"
          className="font-medium text-teal-800 underline"
        >
          Exportación masiva (JSON)
        </a>
        .
      </p>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
