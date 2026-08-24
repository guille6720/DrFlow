"use client";

import { useState } from "react";

import { importHistoricalClinicalDocuments } from "@/features/integraciones/actions/historical-documents-import";
import { PatientSearchCombobox } from "@/features/pacientes/components/pacientes/patient-search-combobox";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CLINICAL_DOCUMENT_CATEGORIES } from "@/lib/constants/clinical-documents";

type ProfessionalOption = { id: string; name: string };

type Props = {
  canImport: boolean;
  professionals: ProfessionalOption[];
};

export function HistoricalDocumentsImportPanel({ canImport, professionals }: Props) {
  const [patientId, setPatientId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Array<{ fileName: string; ok: boolean; error?: string }>>([]);

  if (!canImport) {
    return <p className="text-sm text-slate-600">No tenés permiso para importar documentos clínicos.</p>;
  }

  async function onSubmit(formData: FormData) {
    setBusy(true);
    setError(null);
    setResults([]);
    const result = await importHistoricalClinicalDocuments(formData);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setResults(result.results ?? []);
  }

  return (
    <form action={(formData) => void onSubmit(formData)} className="space-y-3">
      <p className="text-sm text-slate-600">
        Se adjuntan PDF o imágenes a la ficha. No se extraen SOAP, diagnósticos ni medicación.
      </p>
      <PatientSearchCombobox
        patients={[]}
        name="patient_id"
        label="Paciente"
        required
        searchMode="remote"
        displayMode="detailed"
        onPatientChange={(id) => setPatientId(id)}
      />
      <Select
        name="category"
        label="Tipo de documento"
        defaultValue="historia_clinica"
        options={CLINICAL_DOCUMENT_CATEGORIES.map((item) => ({
          value: item.value,
          label: item.label,
        }))}
      />
      <Input name="document_date" label="Fecha del documento" type="date" required />
      <Input name="source" label="Origen (opcional)" placeholder="Sistema anterior, papel, otro centro…" />
      <Select
        name="professional_id"
        label="Profesional (opcional)"
        defaultValue=""
        options={[
          { value: "", label: "Sin asignar" },
          ...professionals.map((item) => ({ value: item.id, label: item.name })),
        ]}
      />
      <Input name="file" label="Archivos" type="file" accept=".pdf,.jpg,.jpeg,.png" multiple required />
      <Button type="submit" loading={busy} disabled={!patientId}>
        Importar como adjuntos
      </Button>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {results.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {results.map((item) => (
            <li key={item.fileName} className={item.ok ? "text-teal-800" : "text-red-700"}>
              {item.fileName}: {item.ok ? "adjuntado" : item.error}
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
