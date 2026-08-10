"use client";

import { Banknote } from "lucide-react";
import { useState } from "react";

import { PatientSearchCombobox } from "@/features/pacientes/components/pacientes/patient-search-combobox";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  CASH_ATTENTION_TYPES,
  CASH_CHARGE_KINDS,
  CASH_PAYMENT_METHODS,
} from "@/lib/constants/cash-register";

type ProfessionalOption = { id: string; label: string };

type Props = {
  professionals: ProfessionalOption[];
  defaultProfessionalId?: string;
  patientId: string;
  setPatientId: (v: string) => void;
  pending: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
};

export function CashChargeFormSection({
  professionals,
  defaultProfessionalId,
  patientId,
  setPatientId,
  pending,
  error,
  onSubmit,
}: Props) {
  const [selectedPatientLabel, setSelectedPatientLabel] = useState<
    { id: string; first_name: string; last_name: string; document_number: string } | undefined
  >(undefined);

  return (
    <>
      <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <PatientSearchCombobox
            patients={
              selectedPatientLabel
                ? [selectedPatientLabel]
                : patientId
                  ? [{ id: patientId, first_name: "", last_name: "", document_number: "" }]
                  : []
            }
            defaultPatientId={patientId || undefined}
            label="Paciente"
            placeholder="Escribí nombre, apellido o DNI…"
            displayMode="detailed"
            onPatientChange={(id, patient) => {
              setPatientId(id);
              if (patient) {
                setSelectedPatientLabel({
                  id: patient.id,
                  first_name: patient.first_name,
                  last_name: patient.last_name,
                  document_number: patient.document_number,
                });
              }
            }}
          />
        </div>

        <Select
          name="professional_id"
          label="Profesional"
          defaultValue={defaultProfessionalId ?? ""}
          options={[
            { value: "", label: "— Opcional —" },
            ...professionals.map((p) => ({ value: p.id, label: p.label })),
          ]}
        />

        <Select
          name="attention_type"
          label="Tipo de atención"
          defaultValue="particular"
          options={CASH_ATTENTION_TYPES.map((a) => ({ value: a.value, label: a.label }))}
        />

        <Select
          name="charge_kind"
          label="Tipo de cobro"
          defaultValue="consulta_particular"
          options={CASH_CHARGE_KINDS.map((c) => ({ value: c.value, label: c.label }))}
        />

        <Select
          name="payment_method"
          label="Medio de pago"
          defaultValue="cash"
          options={CASH_PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }))}
        />

        <input type="hidden" name="motive" value="" />
        <div>
          <label className="drflow-ui-label mb-1 block text-sm font-medium">Importe ($)</label>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            className="drflow-ui-input w-full rounded-xl border px-3 py-3 text-lg font-semibold"
            placeholder="0,00"
          />
        </div>

        <div className="flex items-end lg:col-span-2">
          <Button type="submit" size="lg" loading={pending} className="min-h-12 w-full sm:w-auto">
            <Banknote className="h-5 w-5" />
            Cobrar
          </Button>
        </div>
      </form>
      {error && (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
