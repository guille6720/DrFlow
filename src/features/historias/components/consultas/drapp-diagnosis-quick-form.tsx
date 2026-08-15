"use client";

import { useMemo, useState } from "react";

import { ClinicalFavoritesProvider } from "@/features/historias/components/historias/clinical-favorites-provider";
import {
  DiagnosisAutocomplete,
  type DiagnosisAutocompleteSelection,
} from "@/features/historias/components/historias/diagnosis-autocomplete";
import type { ClinicalDiagnosisEntry } from "@/features/historias/utils/clinical-structured-entries";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onSave: (entry: ClinicalDiagnosisEntry, notes: string) => Promise<void>;
  saving: boolean;
};

function toLocalDateInput(value = new Date()): string {
  const offset = value.getTimezoneOffset();
  const local = new Date(value.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

export function DrappDiagnosisQuickForm({ onDirtyChange, onCancel, onSave, saving }: Props) {
  const [selected, setSelected] = useState<ClinicalDiagnosisEntry | null>(null);
  const [name, setName] = useState("");
  const [cie10, setCie10] = useState("");
  const [startedOn, setStartedOn] = useState(toLocalDateInput);
  const [endedOn, setEndedOn] = useState("");
  const [condition, setCondition] = useState("activo");
  const [chronicity, setChronicity] = useState<"cronico" | "agudo" | "">("");
  const [notes, setNotes] = useState("");

  const dirty = useMemo(
    () =>
      Boolean(
        selected ||
          name.trim() ||
          cie10.trim() ||
          notes.trim() ||
          endedOn ||
          chronicity ||
          condition !== "activo"
      ),
    [selected, name, cie10, notes, endedOn, chronicity, condition]
  );

  function touch(nextDirty = true) {
    onDirtyChange(nextDirty || dirty);
  }

  function handleSelect(selection: DiagnosisAutocompleteSelection) {
    setSelected({
      name: selection.name,
      cie10_code: selection.cie10_code ?? null,
      cie11_code: selection.cie11_code ?? null,
      snomed_code: selection.snomed_code ?? null,
      clinical_diagnosis_id: selection.clinical_diagnosis_id ?? null,
      is_chronic: chronicity === "cronico",
    });
    setName(selection.name);
    setCie10(selection.cie10_code ?? "");
    onDirtyChange(true);
  }

  async function handleSave() {
    const entryName = (selected?.name || name).trim();
    if (!entryName) return;
    const obsParts = [
      notes.trim(),
      condition ? `Estado: ${condition}` : "",
      startedOn ? `Inicio: ${startedOn}` : "",
      endedOn ? `Fin: ${endedOn}` : "",
    ].filter(Boolean);
    await onSave(
      {
        name: entryName,
        cie10_code: (cie10 || selected?.cie10_code || "").trim() || null,
        cie11_code: selected?.cie11_code ?? null,
        snomed_code: selected?.snomed_code ?? null,
        clinical_diagnosis_id: selected?.clinical_diagnosis_id ?? null,
        is_chronic: chronicity === "cronico",
      },
      obsParts.join(" · ")
    );
  }

  return (
    <ClinicalFavoritesProvider>
      <div className="drapp-consulta-quick-panel space-y-3 border-t border-[#efe6b8] bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          + Diagnóstico
        </p>
        <DiagnosisAutocomplete
          label="Buscar diagnóstico"
          placeholder="Nombre, descripción o CIE-10…"
          onSelect={handleSelect}
          allowFreeText
          addButtonLabel="+ Usar este diagnóstico"
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            label="Diagnóstico"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSelected(null);
              touch();
            }}
          />
          <Input
            label="Código CIE-10"
            value={cie10}
            onChange={(e) => {
              setCie10(e.target.value);
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
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600">Condición / estado</span>
            <select
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
              value={condition}
              onChange={(e) => {
                setCondition(e.target.value);
                touch();
              }}
            >
              <option value="activo">Activo</option>
              <option value="resuelto">Resuelto</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600">Crónico / agudo</span>
            <select
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
              value={chronicity}
              onChange={(e) => {
                setChronicity(e.target.value as "cronico" | "agudo" | "");
                touch();
              }}
            >
              <option value="">Sin especificar</option>
              <option value="cronico">Crónico</option>
              <option value="agudo">Agudo</option>
            </select>
          </label>
        </div>
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
            disabled={!(name.trim() || selected?.name)}
            onClick={() => void handleSave()}
          >
            Guardar
          </Button>
        </div>
      </div>
    </ClinicalFavoritesProvider>
  );
}
