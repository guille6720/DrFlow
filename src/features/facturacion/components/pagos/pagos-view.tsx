"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Header } from "@/core/components/layout/header";
import { unwrapNestedRow } from "@/core/supabase/nested-row";
import type { PatientPickerRow, PaymentListRow } from "@/core/supabase/query-types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createMockPayment } from "@/lib/actions/clinic-services";
import { formatCurrency } from "@/lib/services/payments";
import type { Clinic, UserRole } from "@/types/database";

interface Props {
  payments: PaymentListRow[];
  patients: PatientPickerRow[];
  clinics: { clinic_id: string; clinic?: Clinic }[];
  clinicId: string | null;
  role: UserRole | null;
  userName?: string;
}

const statusLabels = { pending: "Pendiente", paid: "Pagado", rejected: "Rechazado" };
const statusVariant = { pending: "warning", paid: "success", rejected: "danger" } as const;

export function PagosView({ payments, patients, clinics, clinicId, role, userName }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await createMockPayment(new FormData(e.currentTarget));
    setLoading(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <>
      <Header
        title="Pagos"
        subtitle="Lab: mock Mercado Pago — aún no es cobro real"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={userName}
      />

      <div className="space-y-6 p-4 sm:p-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Esto es un simulador para probar el flujo. No se conecta a Mercado Pago.
        </div>
        <Card title="Registrar pago (simulado)">
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3">
            <Select
              name="patient_id"
              label="Paciente"
              required
              options={patients.map((p) => ({
                value: p.id,
                label: `${p.last_name}, ${p.first_name}`,
              }))}
              placeholder="Seleccionar"
            />
            <Input name="amount" label="Total consulta" type="number" step="0.01" required />
            <Input name="deposit_amount" label="Seña / reserva" type="number" step="0.01" defaultValue="0" />
            {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
            <div className="sm:col-span-3">
              <Button type="submit" loading={loading}>
                <CreditCard className="h-4 w-4" /> Simular pago Mercado Pago
              </Button>
            </div>
          </form>
        </Card>

        <Card title="Historial de pagos">
          {payments.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="Sin pagos registrados"
              description="Los pagos simulados aparecerán acá con estado y referencia mock."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="pb-2 pr-4">Paciente</th>
                    <th className="pb-2 pr-4">Monto</th>
                    <th className="pb-2 pr-4">Seña</th>
                    <th className="pb-2 pr-4">Estado</th>
                    <th className="pb-2">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-slate-50">
                      <td className="py-2 pr-4">
                        {(() => {
                          const linked = unwrapNestedRow(p.patients);
                          return linked
                            ? `${linked.last_name}, ${linked.first_name}`
                            : "—";
                        })()}
                      </td>
                      <td className="py-2 pr-4">{formatCurrency(Number(p.amount))}</td>
                      <td className="py-2 pr-4">{formatCurrency(Number(p.deposit_amount))}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={statusVariant[p.status]}>{statusLabels[p.status]}</Badge>
                      </td>
                      <td className="py-2">
                        {format(new Date(p.paid_at ?? p.created_at), "PP", { locale: es })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
