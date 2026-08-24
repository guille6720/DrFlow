"use client";

import { useRef, useState } from "react";

import { AddonUpgradeNotice } from "@/core/components/entitlements/addon-upgrade-notice";
import { useCanUseFeature } from "@/core/components/entitlements/entitlements-provider";
import { FEATURES } from "@/core/entitlements/features";

import {
  confirmFhirImportSession,
  createFhirImportSession,
  type FhirImportPreview,
} from "@/features/integraciones/actions/fhir-import-session";
import {
  defaultDuplicateDecisions,
  type DuplicateDecision,
  type DuplicateDecisionSet,
} from "@/features/integraciones/lib/patient-import-duplicates";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type Props = { canImport: boolean };

export function FhirImportPanel({ canImport }: Props) {
  const entitled = useCanUseFeature(FEATURES.INTEGRATIONS);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<FhirImportPreview | null>(null);
  const [decisions, setDecisions] = useState<DuplicateDecisionSet>(defaultDuplicateDecisions());
  const [result, setResult] = useState<string | null>(null);

  if (!canImport) {
    return <p className="text-sm text-slate-600">No tenés permiso para importar FHIR.</p>;
  }

  if (!entitled) {
    return <AddonUpgradeNotice feature={FEATURES.INTEGRATIONS} />;
  }

  async function onUpload(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    const form = new FormData();
    form.set("file", file);
    const response = await createFhirImportSession(form);
    setBusy(false);
    if (response.error || !response.preview) {
      setError(response.error ?? "No se pudo leer el Bundle.");
      return;
    }
    setPreview(response.preview);
  }

  async function onConfirm() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    const response = await confirmFhirImportSession(preview.sessionId, decisions);
    setBusy(false);
    if (response.error || !response.result) {
      setError(response.error ?? "No se pudo importar.");
      return;
    }
    const applied = response.result;
    setResult(
      `Pacientes nuevos ${applied.patientsCreated}, actualizados ${applied.patientsUpdated}, omitidos ${applied.patientsSkipped}. Consultas nuevas ${applied.recordsCreated}, ya existentes ${applied.recordsSkipped}.`
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Bundle FHIR R4 (Patient, Encounter, Condition, AllergyIntolerance, MedicationRequest). No se pisan
        consultas existentes; los demográficos vacíos se completan solo si confirmás actualizar.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/fhir+json,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onUpload(file);
        }}
      />
      <Button type="button" variant="outline" loading={busy} onClick={() => fileRef.current?.click()}>
        Subir JSON FHIR
      </Button>
      {preview ? (
        <div className="space-y-3 rounded-lg border border-slate-200 p-3 text-sm">
          <p className="font-medium text-slate-900">{preview.fileName}</p>
          <ul className="grid gap-1 sm:grid-cols-2">
            <li>Pacientes: {preview.stats.patients}</li>
            <li>Encuentros: {preview.stats.encounters}</li>
            <li>Recursos: {preview.stats.resources}</li>
            <li>Duplicados: {preview.stats.duplicates}</li>
          </ul>
          {preview.duplicates.length > 0 ? (
            <>
              <Select
                label="Coincidencia exacta (mismo DNI)"
                value={decisions.exactDefault}
                onChange={(event) =>
                  setDecisions((current) => ({
                    ...current,
                    exactDefault: event.target.value as DuplicateDecision,
                  }))
                }
                options={[
                  { value: "keep", label: "Conservar y agregar consultas nuevas" },
                  { value: "update", label: "Completar demográficos vacíos y agregar consultas" },
                  { value: "skip", label: "Omitir paciente" },
                ]}
              />
              <Select
                label="Posible duplicado (nombre + nacimiento)"
                value={decisions.possibleDefault}
                onChange={(event) =>
                  setDecisions((current) => ({
                    ...current,
                    possibleDefault: event.target.value as DuplicateDecision,
                  }))
                }
                options={[
                  { value: "review", label: "Revisar / omitir" },
                  { value: "create", label: "Crear como paciente nuevo" },
                  { value: "skip", label: "Omitir" },
                ]}
              />
              <ul className="max-h-40 space-y-1 overflow-auto text-xs text-slate-700">
                {preview.duplicates.map((item) => (
                  <li key={item.lineNumber}>
                    {item.matchType === "document" ? "DNI" : "Nombre+fecha"}: {item.incoming} → {item.existing}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {preview.warnings.length > 0 ? (
            <p className="text-xs text-amber-800">{preview.warnings.slice(0, 4).join(" · ")}</p>
          ) : null}
          <Button type="button" loading={busy} onClick={() => void onConfirm()}>
            Confirmar migración FHIR
          </Button>
        </div>
      ) : null}
      {result ? <p className="text-sm text-teal-800">{result}</p> : null}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
