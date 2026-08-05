"use client";

import { Banknote, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  CASH_ATTENTION_TYPES,
  CASH_CHARGE_KINDS,
  CASH_PAYMENT_METHODS,
} from "@/lib/constants/cash-register";

type PatientOption = { id: string; label: string };
type ProfessionalOption = { id: string; label: string };

type Props = {
  professionals: ProfessionalOption[];
  filteredPatients: PatientOption[];
  patientSearch: string;
  setPatientSearch: (v: string) => void;
  patientId: string;
  setPatientId: (v: string) => void;
  pending: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
};

export function CashChargeFormSection({
  professionals,
  filteredPatients,
  patientSearch,
  setPatientSearch,
  patientId,
  setPatientId,
  pending,
  error,
  onSubmit,
}: Props) {
  return (
    <>
      <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <label className="drflow-ui-label mb-1 block text-sm font-medium">Paciente</label>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 opacity-40" />
            <input
              type="search"
              placeholder="Buscar por nombre o DNI…"
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              className="drflow-ui-input w-full rounded-xl border py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <select
            required
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className="drflow-ui-input drflow-ui-select w-full rounded-xl border px-3 py-2.5 text-sm"
            size={Math.min(5, Math.max(3, filteredPatients.length))}
          >
            <option value="">— Elegir paciente —</option>
            {filteredPatients.slice(0, 80).map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <Select
          name="professional_id"
          label="Profesional"
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
