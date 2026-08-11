"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus } from "lucide-react";
import Link from "next/link";

import type {
  OsLiquidationBatchRow,
  OsPendingSummaryRow,
} from "@/features/facturacion/utils/os-liquidacion";
import {
  formatOsAmount,
  labelOsLiquidationStatus,
} from "@/features/facturacion/utils/os-liquidacion";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Props = {
  batches: OsLiquidationBatchRow[];
  pending: OsPendingSummaryRow[];
};

export function LiquidacionListView({ batches, pending }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Armá lotes de liquidación desde atenciones realizadas y exportá CSV para presentar a la obra social.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/facturacion/tarifas">
            <Button variant="outline" size="sm">
              Tarifas OS
            </Button>
          </Link>
          <Link href="/facturacion/liquidacion/nueva">
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Nuevo lote
            </Button>
          </Link>
        </div>
      </div>

      {pending.length > 0 ? (
        <Card title="Pendientes de liquidar">
          <ul className="divide-y divide-slate-100 text-sm">
            {pending.map((row) => (
              <li key={row.insurance_provider} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-medium text-slate-900">{row.insurance_provider}</span>
                <span className="text-slate-600">
                  {row.pending_count} ítems · {formatOsAmount(row.pending_amount)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card title="Lotes de liquidación">
        {batches.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay lotes todavía. Configurá tarifas por obra social y creá el primer lote.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-4">Obra social</th>
                  <th className="py-2 pr-4">Período</th>
                  <th className="py-2 pr-4">Ítems</th>
                  <th className="py-2 pr-4">Total</th>
                  <th className="py-2 pr-4">Estado</th>
                  <th className="py-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-medium">{batch.insurance_provider}</td>
                    <td className="py-3 pr-4 text-slate-600">
                      {format(new Date(batch.period_from), "dd/MM/yy", { locale: es })} —{" "}
                      {format(new Date(batch.period_to), "dd/MM/yy", { locale: es })}
                    </td>
                    <td className="py-3 pr-4">{batch.item_count}</td>
                    <td className="py-3 pr-4">{formatOsAmount(batch.total_amount)}</td>
                    <td className="py-3 pr-4">{labelOsLiquidationStatus(batch.status)}</td>
                    <td className="py-3">
                      <Link href={`/facturacion/liquidacion/${batch.id}`}>
                        <Button variant="outline" size="sm">
                          Ver
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
