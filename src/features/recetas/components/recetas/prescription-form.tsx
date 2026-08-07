"use client";

import { useState } from "react";

import { PrescriptionDiagnosisFields } from "@/features/recetas/components/recetas/prescription-diagnosis-fields";
import { PrescriptionMedicationsSection } from "@/features/recetas/components/recetas/prescription-medications-section";
import { usePrescriptionForm } from "@/features/recetas/hooks/use-prescription-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getProfessionalDisplayName } from "@/lib/utils/professional";
import type { PrescriptionMedication } from "@/types/prescription";

interface Professional {
  id: string;
  license_number?: string | null;
  display_name?: string | null;
  profiles?: { full_name: string } | null;
}

interface Props {
  patientId: string;
  patientInsurance?: string | null;
  clinicalRecordId?: string;
  diagnosisDefault?: string;
  cie10Default?: string;
  professionals: Professional[];
  defaultProfessionalId?: string;
  initialMedications?: PrescriptionMedication[];
  onSuccess?: () => void;
}

export function PrescriptionForm({
  patientId,
  patientInsurance,
  clinicalRecordId,
  diagnosisDefault = "",
  cie10Default = "",
  professionals,
  defaultProfessionalId,
  initialMedications,
  onSuccess,
}: Props) {
  const [notes, setNotes] = useState("");

  const {
    diagnosisText,
    setDiagnosisText,
    cie10,
    setCie10,
    medications,
    setMedications,
    error,
    loading,
    disclaimerAccepted,
    setDisclaimerAccepted,
    updateMed,
    handleSubmit,
  } = usePrescriptionForm({
    patientId,
    clinicalRecordId,
    initialMedications,
    diagnosisDefault,
    cie10Default,
    onSuccess,
  });

  return (
    <form id="prescription-form" className="space-y-4" onSubmit={(e) => e.preventDefault()}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          name="professional_id"
          label="Profesional prescriptor"
          required
          defaultValue={defaultProfessionalId}
          options={professionals.map((p) => ({
            value: p.id,
            label: `${getProfessionalDisplayName(p)}${p.license_number ? ` — Mat. ${p.license_number}` : ""}`,
          }))}
          placeholder="Seleccionar"
        />
        <Select
          name="prescription_type"
          label="Tipo de receta"
          required
          defaultValue="ambulatoria"
          options={[
            { value: "ambulatoria", label: "Ambulatoria" },
            { value: "cronica", label: "Crónica / prolongada" },
            { value: "duplicado", label: "Duplicado (psicotrópicos)" },
          ]}
        />
        <PrescriptionDiagnosisFields
          diagnosisText={diagnosisText}
          cie10={cie10}
          onDiagnosisTextChange={setDiagnosisText}
          onCie10Change={setCie10}
        />
        <Input
          name="patient_insurance"
          label="Obra social / prepaga"
          defaultValue={patientInsurance ?? ""}
          placeholder="Opcional"
        />
        <Input name="validity_days" label="Vigencia (días)" type="number" defaultValue={30} min={1} max={365} />
      </div>

      <PrescriptionMedicationsSection
        medications={medications}
        setMedications={setMedications}
        updateMed={updateMed}
      />

      <Textarea
        name="notes"
        label="Observaciones"
        rows={2}
        placeholder="Indicaciones adicionales para farmacia"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-950">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0 rounded border-amber-400 text-amber-700 focus:ring-amber-500"
          checked={disclaimerAccepted}
          onChange={(e) => setDisclaimerAccepted(e.target.checked)}
          required
        />
        <span>
          Entiendo que esta es una <strong>receta local / borrador</strong> y{" "}
          <strong>no constituye homologación REFEPS</strong> ni firma digital homologada.
        </span>
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          loading={loading}
          disabled={!disclaimerAccepted}
          onClick={() => handleSubmit(false)}
        >
          Guardar borrador
        </Button>
        <Button
          type="button"
          loading={loading}
          disabled={!disclaimerAccepted}
          onClick={() => handleSubmit(true)}
        >
          Emitir receta
        </Button>
      </div>
    </form>
  );
}
