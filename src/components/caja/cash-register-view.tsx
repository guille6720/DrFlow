"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Banknote, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { createCashCharge, voidCashCharge } from "@/lib/actions/cash-register";
import {
  CASH_ATTENTION_TYPES,
  CASH_CHARGE_KINDS,
  CASH_PAYMENT_METHODS,
  labelForChargeKind,
  labelForPaymentMethod,
} from "@/lib/constants/cash-register";

type PatientOption = { id: string; label: string };
type ProfessionalOption = { id: string; label: string };

type ChargeRow = {
  id: string;
  charged_at: string;
  amount: number;
  charge_kind: string;
  payment_method: string;
  status: string;
  motive: string | null;
  patients?: { first_name: string; last_name: string } | null;
};

export function CashRegisterView({
  patients,
  professionals,
  recentCharges,
}: {
  patients: PatientOption[];
  professionals: ProfessionalOption[];
  recentCharges: ChargeRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientId, setPatientId] = useState("");

  const filteredPatients = patients.filter((p) =>
    patientSearch.trim() ? p.label.toLowerCase().includes(patientSearch.toLowerCase()) : true
  );

  function handleCharge(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (!patientId) {
      setError("Seleccioná un paciente");
      return;
    }
    fd.set("patient_id", patientId);
    fd.set("status", "collected");
    startTransition(async () => {
      const res = await createCashCharge(fd);
      if (res.error) setError(res.error);
      else {
        (e.target as HTMLFormElement).reset();
        setPatientId("");
        router.refresh();
      }
    });
  }

  function handleVoid(id: string) {
    const reason = prompt("Motivo de anulación:");
    if (!reason?.trim()) return;
    const fd = new FormData();
    fd.set("charge_id", id);
    fd.set("reason", reason);
    startTransition(async () => {
      await voidCashCharge(fd);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card title="Registrar cobro" className="drflow-caja-quick">
        <p className="mb-4 text-sm text-slate-500">
          Paciente → tipo → importe → cobrar. Máximo 3 clics.
        </p>
        <form onSubmit={handleCharge} className="grid gap-4 lg:grid-cols-2">
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
      </Card>

      <Card title="Movimientos de hoy">
        {recentCharges.length === 0 ? (
          <p className="text-sm text-slate-500">Sin cobros registrados hoy.</p>
        ) : (
          <ul className="divide-y divide-slate-600/40">
            {recentCharges.map((c) => {
              const p = c.patients;
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {p ? `${p.last_name}, ${p.first_name}` : "Paciente"} · $
                      {Number(c.amount).toLocaleString("es-AR")}
                    </p>
                    <p className="text-slate-500">
                      {format(new Date(c.charged_at), "HH:mm", { locale: es })} ·{" "}
                      {labelForChargeKind(c.charge_kind)} · {labelForPaymentMethod(c.payment_method)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={c.status === "collected" ? "success" : "danger"}>
                      {c.status === "collected" ? "Cobrado" : c.status}
                    </Badge>
                    {c.status === "collected" && (
                      <Button type="button" size="sm" variant="outline" onClick={() => handleVoid(c.id)}>
                        Anular
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
