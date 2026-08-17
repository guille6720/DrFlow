"use client";

import { useMemo, useState } from "react";

import { ClinicalFavoritesProvider } from "@/features/historias/components/historias/clinical-favorites-provider";
import { ClinicalTreatmentAutocomplete } from "@/features/historias/components/historias/clinical-treatment-autocomplete";
import { MedicationAutocomplete } from "@/features/historias/components/historias/medication-autocomplete";
import type { ClinicalTreatmentEntry } from "@/features/historias/utils/clinical-structured-entries";
import { medicationsToTreatmentEntries } from "@/features/historias/utils/clinical-structured-entries";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PrescriptionMedication } from "@/types/prescription";

type Props = {
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onSave: (treatment: ClinicalTreatmentEntry, medications: PrescriptionMedication[]) => Promise<void>;
  saving: boolean;
};

function toLocalDateInput(value = new Date()): string {
  const offset = value.getTimezoneOffset();
  const local = new Date(value.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

export function DrappTreatmentQuickForm({ onDirtyChange, onCancel, onSave, saving }: Props) {
  const [catalogTreatments, setCatalogTreatments] = useState<ClinicalTreatmentEntry[]>([]);
  const [medications, setMedications] = useState<PrescriptionMedication[]>([]);
  const [product, setProduct] = useState("");
  const [activeIngredient, setActiveIngredient] = useState("");
  const [dose, setDose] = useState("");
  const [presentation, setPresentation] = useState("");
  const [frequency, setFrequency] = useState("");
  const [route, setRoute] = useState("");
  const [instructions, setInstructions] = useState("");
  const [startedOn, setStartedOn] = useState(toLocalDateInput);
  const [endedOn, setEndedOn] = useState("");
  const [status, setStatus] = useState("Actual");
  const [notes, setNotes] = useState("");

  const dirty = useMemo(
    () =>
      catalogTreatments.length > 0 ||
      medications.length > 0 ||
      Boolean(
        product.trim() ||
          activeIngredient.trim() ||
          dose.trim() ||
          presentation.trim() ||
          frequency.trim() ||
          route.trim() ||
          instructions.trim() ||
          notes.trim() ||
          endedOn
      ),
    [
      catalogTreatments,
      medications,
      product,
      activeIngredient,
      dose,
      presentation,
      frequency,
      route,
      instructions,
      notes,
      endedOn,
    ]
  );

  function touch() {
    onDirtyChange(true);
  }

  function handleCatalogTreatmentsChange(next: ClinicalTreatmentEntry[]) {
    setCatalogTreatments(next);
    const last = next.at(-1);
    if (last) {
      setProduct(last.product);
      setActiveIngredient(last.active_ingredient || last.product);
      if (last.dose) setDose(last.dose);
      if (last.frequency) setFrequency(last.frequency);
      if (last.status) setStatus(last.status);
    }
    onDirtyChange(true);
  }

  function handleMedicationsChange(next: PrescriptionMedication[]) {
    setMedications(next);
    const last = next.at(-1);
    if (last) {
      setProduct(last.brand_name?.trim() || last.generic_name);
      setActiveIngredient(last.active_ingredient || last.generic_name);
      setPresentation(last.presentation ?? "");
      setDose(last.dose ?? "");
      setFrequency(last.frequency ?? last.posology ?? "");
    }
    onDirtyChange(true);
  }

  async function handleSave() {
    const fromMeds = medicationsToTreatmentEntries(medications);
    const base = catalogTreatments[0] ?? fromMeds[0];
    const productName = (base?.product || product).trim();
    if (!productName) return;

    const noteParts = [
      instructions.trim(),
      notes.trim(),
      route.trim() ? `Vía: ${route.trim()}` : "",
      presentation.trim() ? `Presentación: ${presentation.trim()}` : "",
      startedOn ? `Inicio: ${startedOn}` : "",
      endedOn ? `Fin: ${endedOn}` : "",
    ].filter(Boolean);

    await onSave(
      {
        product: productName,
        dose: (dose || base?.dose || "").trim() || undefined,
        frequency: (frequency || base?.frequency || "").trim() || undefined,
        notes: noteParts.join(" · ") || undefined,
        status,
        active_ingredient: (activeIngredient || base?.active_ingredient || "").trim() || undefined,
        kind: base?.kind ?? (medications.length > 0 ? "medication" : "free_text"),
        category: base?.category ?? (medications.length > 0 ? "Medicamento" : "Texto libre"),
        clinical_treatment_id: base?.clinical_treatment_id ?? null,
        vademecum_code: base?.vademecum_code ?? null,
        catalog_source: base?.catalog_source ?? null,
        quantity: base?.quantity,
      },
      medications
    );
  }

  return (
    <ClinicalFavoritesProvider>
      <div className="drapp-consulta-quick-panel relative z-20 space-y-3 overflow-visible border-t border-[#efe6b8] bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          + Tratamiento
        </p>
        <ClinicalTreatmentAutocomplete
          treatments={catalogTreatments}
          onTreatmentsChange={handleCatalogTreatmentsChange}
          label="Buscar tratamiento"
          placeholder="Ej. IECA, amlodipina, antiinflamatorio, dieta…"
        />
        <MedicationAutocomplete
          medications={medications}
          onMedicationsChange={handleMedicationsChange}
          label="Buscar medicamento (vademécum)"
          placeholder="Ej. AMOX, enalapril, amlodipina…"
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            label="Tratamiento / medicación"
            value={product}
            onChange={(e) => {
              setProduct(e.target.value);
              touch();
            }}
          />
          <Input
            label="Principio activo"
            value={activeIngredient}
            onChange={(e) => {
              setActiveIngredient(e.target.value);
              touch();
            }}
          />
          <Input
            label="Dosis"
            value={dose}
            onChange={(e) => {
              setDose(e.target.value);
              touch();
            }}
          />
          <Input
            label="Presentación"
            value={presentation}
            onChange={(e) => {
              setPresentation(e.target.value);
              touch();
            }}
          />
          <Input
            label="Frecuencia"
            value={frequency}
            onChange={(e) => {
              setFrequency(e.target.value);
              touch();
            }}
          />
          <Input
            label="Vía"
            value={route}
            onChange={(e) => {
              setRoute(e.target.value);
              touch();
            }}
          />
          <Input
            type="date"
            label="Fecha de inicio"
            value={startedOn}
            onChange={(e) => {
              setStartedOn(e.target.value);
              touch();
            }}
          />
          <Input
            type="date"
            label="Fecha de finalización"
            value={endedOn}
            onChange={(e) => {
              setEndedOn(e.target.value);
              touch();
            }}
          />
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-slate-600">Estado</span>
            <select
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                touch();
              }}
            >
              <option value="Actual">Actual</option>
              <option value="Suspendido">Suspendido</option>
              <option value="Completado">Completado</option>
            </select>
          </label>
        </div>
        <Textarea
          label="Indicaciones"
          rows={2}
          value={instructions}
          onChange={(e) => {
            setInstructions(e.target.value);
            touch();
          }}
        />
        <Textarea
          label="Observaciones"
          rows={2}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            touch();
          }}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" disabled={saving} onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            loading={saving}
            pendingLabel="Guardando..."
            disabled={!product.trim() && medications.length === 0 && catalogTreatments.length === 0}
            onClick={() => void handleSave()}
          >
            Guardar
          </Button>
        </div>
        <span className="sr-only">{dirty ? "dirty" : "clean"}</span>
      </div>
    </ClinicalFavoritesProvider>
  );
}
