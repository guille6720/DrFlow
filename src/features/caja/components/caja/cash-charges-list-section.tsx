"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { labelForChargeKind, labelForPaymentMethod } from "@/lib/constants/cash-register";

type ChargeRow = {
  id: string;
  charged_at: string;
  amount: number;
  charge_kind: string;
  payment_method: string;
  status: string;
  patients?: { first_name: string; last_name: string } | null;
};

export function CashChargesListSection({
  recentCharges,
  onVoid,
}: {
  recentCharges: ChargeRow[];
  onVoid: (id: string) => void;
}) {
  return (
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
                    <Button type="button" size="sm" variant="outline" onClick={() => onVoid(c.id)}>
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
  );
}
