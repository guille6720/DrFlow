"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Download } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type {
  OsBillableItemRow,
  OsLiquidationBatchRow,
} from "@/features/facturacion/utils/os-liquidacion";
import {
  buildOsLiquidationCsv,
  formatOsAmount,
  isOsLiquidationActionable,
  labelOsBillableStatus,
  labelOsLiquidationStatus,
} from "@/features/facturacion/utils/os-liquidacion";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { updateOsLiquidationBatchStatus } from "@/lib/actions/os-liquidacion";

type Props = {
  batch: OsLiquidationBatchRow;
  items: OsBillableItemRow[];
};

export function LiquidacionBatchView({ batch, items }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const netTotal = useMemo(
    () => items.reduce((sum, item) => sum + Math.max(0, item.amount - item.copago_collected), 0),
    [items]
  );

  function downloadCsv() {
    const csv = buildOsLiquidationCsv(items);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `liquidacion-${batch.insurance_provider.replace(/\s+/g, "-")}-${batch.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function changeStatus(status: "submitted" | "paid" | "cancelled") {
    if (status === "cancelled" && !window.confirm("¿Anular este lote? Los ítems volverán a pendientes.")) {
      return;
    }
    setLoading(status);
    setError(null);
    const fd = new FormData();
    fd.set("batch_id", batch.id);
    fd.set("status", status);
    const result = await updateOsLiquidationBatchStatus(fd);
    setLoading(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Link href="/facturacion/liquidacion">
        <Button variant="outline" size="sm">
          ← Volver
        </Button>
      </Link>

      <Card title={`Liquidación — ${batch.insurance_provider}`}>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <dt className="text-xs uppercase text-slate-500">Período</dt>
            <dd>
              {format(new Date(batch.period_from), "PP", { locale: es })} —{" "}
              {format(new Date(batch.period_to), "PP", { locale: es })}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Estado</dt>
            <dd className="font-medium">{labelOsLiquidationStatus(batch.status)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Ítems</dt>
            <dd>{batch.item_count}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Total bruto / neto</dt>
            <dd>
              {formatOsAmount(batch.total_amount)} / {formatOsAmount(netTotal)}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={downloadCsv} disabled={items.length === 0}>
            <Download className="mr-1 h-4 w-4" />
            Exportar CSV
          </Button>
          {batch.status === "draft" ? (
            <Button
              type="button"
              size="sm"
              loading={loading === "submitted"}
              onClick={() => changeStatus("submitted")}
            >
              Marcar presentado
            </Button>
          ) : null}
          {batch.status === "submitted" ? (
            <Button type="button" size="sm" loading={loading === "paid"} onClick={() => changeStatus("paid")}>
              Marcar acreditado
            </Button>
          ) : null}
          {isOsLiquidationActionable(batch.status) ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              loading={loading === "cancelled"}
              onClick={() => changeStatus("cancelled")}
            >
              Anular lote
            </Button>
          ) : null}
        </div>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </Card>

      <Card title="Detalle de ítems">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay ítems en este lote. Verificá que existan atenciones atendidas con tarifa configurada para esta
            obra social en el período.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Paciente</th>
                  <th className="py-2 pr-3">Profesional</th>
                  <th className="py-2 pr-3">Afiliado</th>
                  <th className="py-2 pr-3">Importe</th>
                  <th className="py-2 pr-3">Copago</th>
                  <th className="py-2 pr-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {format(new Date(item.attended_at), "dd/MM/yyyy HH:mm", { locale: es })}
                    </td>
                    <td className="py-2 pr-3">{item.patient_name ?? "—"}</td>
                    <td className="py-2 pr-3">{item.professional_name ?? "—"}</td>
                    <td className="py-2 pr-3">{item.insurance_number ?? "—"}</td>
                    <td className="py-2 pr-3">{formatOsAmount(item.amount)}</td>
                    <td className="py-2 pr-3">{formatOsAmount(item.copago_collected)}</td>
                    <td className="py-2 pr-3">{labelOsBillableStatus(item.status)}</td>
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
