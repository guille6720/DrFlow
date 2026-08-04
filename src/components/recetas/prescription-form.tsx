"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PrescriptionPharmacologyPicker } from "@/components/recetas/prescription-pharmacology-picker";
import { PrescriptionMedicationsSection } from "@/components/recetas/prescription-medications-section";
import { PrescriptionPhysicianAssist } from "@/components/clinical-workflow/prescription-physician-assist";
import { usePrescriptionForm } from "@/lib/hooks/use-prescription-form";
import { getProfessionalDisplayName } from "@/lib/utils/professional";
import type { PhysicianAssistContext } from "@/lib/utils/physician-assist-types";
import type { PrescriptionMedication } from "@/types/prescription";
import { ARGENTINA_PRESCRIPTION_DISCLAIMER } from "@/types/prescription";

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
  assistContext?: PhysicianAssistContext;
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
  assistContext,
}: Props) {
  const [notes, setNotes] = useState("");
  const [alertsReady, setAlertsReady] = useState(true);

  const {
    cie10Ref,
    diagnosisTextRef,
    medications,
    setMedications,
    error,
    loading,
    disclaimerAccepted,
    setDisclaimerAccepted,
    existingGenericNames,
    updateMed,
    addMedicationsFromGuide,
    handlePathologySelect,
    handleSubmit,
  } = usePrescriptionForm({
    patientId,
    clinicalRecordId,
    initialMedications,
    onSuccess,
  });

  return (
    <form id="prescription-form" className="space-y-4" onSubmit={(e) => e.preventDefault()}>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        {ARGENTINA_PRESCRIPTION_DISCLAIMER}
      </div>

      <PrescriptionPharmacologyPicker
        onPathologySelect={handlePathologySelect}
        onAddMedications={addMedicationsFromGuide}
        existingGenericNames={existingGenericNames}
      />

      {assistContext ? (
        <PrescriptionPhysicianAssist
          context={{
            ...assistContext,
            insurance: assistContext.insurance ?? patientInsurance ?? undefined,
          }}
          medicationNames={medications
            .map((m) => m.generic_name || m.brand_name || "")
            .filter(Boolean)}
          onApplyPrescriptionNotes={(text) =>
            setNotes((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text))
          }
          onAlertGateChange={setAlertsReady}
        />
      ) : null}

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
        <Input
          ref={cie10Ref}
          name="diagnosis_cie10"
          label="Diagnóstico CIE-10"
          required
          defaultValue={cie10Default}
          placeholder="Ej: I10, J06.9"
        />
        <Input
          name="patient_insurance"
          label="Obra social / prepaga"
          defaultValue={patientInsurance ?? ""}
          placeholder="Opcional"
        />
        <div className="sm:col-span-2">
          <Input
            ref={diagnosisTextRef}
            name="diagnosis_text"
            label="Diagnóstico (texto)"
            required
            defaultValue={diagnosisDefault}
            placeholder="Ej: Hipertensión arterial esencial"
          />
        </div>
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

      {!alertsReady ? (
        <p className="text-sm text-amber-800">
          Revisá y confirmá las alertas medicamentosas antes de emitir la receta.
        </p>
      ) : null}

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
          <strong>no constituye homologación REFEPS</strong>. Acepto el aviso legal de arriba.
        </span>
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          loading={loading}
          disabled={!disclaimerAccepted || !alertsReady}
          onClick={() => handleSubmit(false)}
        >
          Guardar borrador
        </Button>
        <Button
          type="button"
          loading={loading}
          disabled={!disclaimerAccepted || !alertsReady}
          onClick={() => handleSubmit(true)}
        >
          Emitir receta
        </Button>
      </div>
    </form>
  );
}
