"use client";

import { useEffect, useMemo, useState } from "react";

import {
  computeBmi,
  EMPTY_VITALS_FORM,
  vitalsFormHasAnyValue,
  type VitalsFormValues,
} from "@/features/historias/utils/vitals-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onSave: (values: VitalsFormValues) => Promise<void>;
  saving: boolean;
};

function toDatetimeLocalValue(date = new Date()): string {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function DrappVitalsQuickForm({ onDirtyChange, onCancel, onSave, saving }: Props) {
  const [values, setValues] = useState<VitalsFormValues>(() => ({
    ...EMPTY_VITALS_FORM,
    recordedAt: toDatetimeLocalValue(),
  }));

  const dirty = useMemo(() => vitalsFormHasAnyValue(values), [values]);
  const bmi = computeBmi(values.weight, values.height);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  function patch(partial: Partial<VitalsFormValues>) {
    setValues((current) => ({ ...current, ...partial }));
  }

  return (
    <div className="drapp-consulta-quick-panel space-y-3 border-t border-[#efe6b8] bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signos vitales</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input label="TAS (mmHg)" inputMode="numeric" value={values.tas} onChange={(e) => patch({ tas: e.target.value })} />
        <Input label="TAD (mmHg)" inputMode="numeric" value={values.tad} onChange={(e) => patch({ tad: e.target.value })} />
        <Input label="FC (lpm)" inputMode="numeric" value={values.fc} onChange={(e) => patch({ fc: e.target.value })} />
        <Input label="FR (rpm)" inputMode="numeric" value={values.fr} onChange={(e) => patch({ fr: e.target.value })} />
        <Input
          label="Temperatura (°C)"
          inputMode="decimal"
          value={values.temperature}
          onChange={(e) => patch({ temperature: e.target.value })}
        />
        <Input
          label="SatO2 (%)"
          inputMode="numeric"
          value={values.satO2}
          onChange={(e) => patch({ satO2: e.target.value })}
        />
        <Input
          label="Peso (kg)"
          inputMode="decimal"
          value={values.weight}
          onChange={(e) => patch({ weight: e.target.value })}
        />
        <Input
          label="Altura (cm)"
          inputMode="decimal"
          value={values.height}
          onChange={(e) => patch({ height: e.target.value })}
        />
        <Input label="IMC (auto)" value={bmi ?? ""} readOnly />
        <Input
          type="datetime-local"
          label="Fecha y hora"
          value={values.recordedAt}
          onChange={(e) => patch({ recordedAt: e.target.value })}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" disabled={saving} onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          loading={saving}
          disabled={!dirty}
          onClick={() => void onSave(values)}
        >
          Guardar
        </Button>
      </div>
    </div>
  );
}
