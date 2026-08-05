"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { closeDailyCash } from "@/lib/actions/cash-register";
import { CASH_PAYMENT_METHODS, labelForPaymentMethod } from "@/lib/constants/cash-register";

type Totals = Record<string, number>;

export function CashClosureView({
  date,
  totals,
  patientCount,
  consultationCount,
  existingNotes,
}: {
  date: string;
  totals: Totals;
  patientCount: number;
  consultationCount: number;
  existingNotes?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [diff, setDiff] = useState("0");
  const [notes, setNotes] = useState(existingNotes ?? "");

  const general = totals.general ?? 0;

  function exportExcel() {
    const rows = [
      ["Cierre de caja", date],
      ["Total general", general],
      ...CASH_PAYMENT_METHODS.map((m) => [
        labelForPaymentMethod(m.value),
        totals[m.value] ?? 0,
      ]),
      ["Consultas particulares", totals.particular ?? 0],
      ["Copagos", totals.copago ?? 0],
      ["Coseguros", totals.coseguro ?? 0],
      ["ART", totals.art ?? 0],
      ["Obras sociales", totals.obra_social ?? 0],
      ["Pacientes", patientCount],
      ["Consultas", consultationCount],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cierre");
    XLSX.writeFile(wb, `cierre-caja-${date}.xlsx`);
  }

  function handleClose(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("closure_date", date);
    fd.set("cash_difference", diff);
    fd.set("notes", notes);
    startTransition(async () => {
      await closeDailyCash(fd);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card title={`Resumen ${format(new Date(date), "PPP", { locale: es })}`}>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs uppercase text-slate-500">Total general</dt>
            <dd className="text-2xl font-bold">${general.toLocaleString("es-AR")}</dd>
          </div>
          {CASH_PAYMENT_METHODS.map((m) => (
            <div key={m.value}>
              <dt className="text-xs uppercase text-slate-500">{m.label}</dt>
              <dd className="text-lg font-semibold">
                ${(totals[m.value] ?? 0).toLocaleString("es-AR")}
              </dd>
            </div>
          ))}
          <div>
            <dt className="text-xs uppercase text-slate-500">Particulares</dt>
            <dd>${(totals.particular ?? 0).toLocaleString("es-AR")}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Copagos</dt>
            <dd>${(totals.copago ?? 0).toLocaleString("es-AR")}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Pacientes</dt>
            <dd>{patientCount}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Consultas</dt>
            <dd>{consultationCount}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => window.print()}>
            Exportar PDF
          </Button>
          <Button type="button" variant="outline" onClick={exportExcel}>
            Exportar Excel
          </Button>
        </div>
      </Card>

      <Card title="Confirmar cierre">
        <form onSubmit={handleClose} className="max-w-md space-y-3">
          <div>
            <label className="drflow-ui-label text-sm">Diferencia de caja ($)</label>
            <input
              type="number"
              step="0.01"
              value={diff}
              onChange={(e) => setDiff(e.target.value)}
              className="drflow-ui-input mt-1 w-full rounded-lg border px-3 py-2"
            />
          </div>
          <div>
            <label className="drflow-ui-label text-sm">Observaciones</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="drflow-ui-input mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <Button type="submit" loading={pending}>
            Cerrar caja del día
          </Button>
        </form>
      </Card>
    </div>
  );
}
