"use client";

import { CashChargeFormSection } from "@/features/caja/components/caja/cash-charge-form-section";
import { CashChargesListSection } from "@/features/caja/components/caja/cash-charges-list-section";
import { useCashRegister } from "@/features/caja/hooks/use-cash-register";

import { Card } from "@/components/ui/card";

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
  defaultProfessionalId,
}: {
  patients: PatientOption[];
  professionals: ProfessionalOption[];
  recentCharges: ChargeRow[];
  defaultProfessionalId?: string;
}) {
  const register = useCashRegister();
  const filteredPatients = register.filterPatients(patients);

  return (
    <div className="space-y-6">
      <Card title="Registrar cobro" className="drflow-caja-quick">
        <p className="mb-4 text-sm text-slate-500">
          Paciente → tipo → importe → cobrar. Máximo 3 clics.
        </p>
        <CashChargeFormSection
          professionals={professionals}
          defaultProfessionalId={defaultProfessionalId}
          filteredPatients={filteredPatients}
          patientSearch={register.patientSearch}
          setPatientSearch={register.setPatientSearch}
          patientId={register.patientId}
          setPatientId={register.setPatientId}
          pending={register.pending}
          error={register.error}
          onSubmit={register.handleCharge}
        />
      </Card>

      <CashChargesListSection recentCharges={recentCharges} onVoid={register.handleVoid} />
    </div>
  );
}
