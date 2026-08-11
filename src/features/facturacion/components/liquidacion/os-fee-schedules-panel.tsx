"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { OsFeeScheduleRow } from "@/features/facturacion/utils/os-liquidacion";
import { formatOsAmount } from "@/features/facturacion/utils/os-liquidacion";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { deleteOsFeeSchedule, upsertOsFeeSchedule } from "@/lib/actions/os-liquidacion";
import { INSURANCE_PROVIDERS } from "@/lib/constants/coverages";

type Props = {
  schedules: OsFeeScheduleRow[];
};

export function OsFeeSchedulesPanel({ schedules }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading("create");
    setMsg(null);
    setErr(null);
    const result = await upsertOsFeeSchedule(new FormData(e.currentTarget));
    setLoading(null);
    if (result.error) setErr(result.error);
    else {
      setMsg("Tarifa guardada.");
      e.currentTarget.reset();
      router.refresh();
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("¿Eliminar esta tarifa?")) return;
    setLoading(id);
    const fd = new FormData();
    fd.set("id", id);
    const result = await deleteOsFeeSchedule(fd);
    setLoading(null);
    if (result.error) setErr(result.error);
    else router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card title="Tarifas por obra social">
        <p className="mb-4 text-sm text-slate-600">
          Definí el importe de consulta por obra social. Solo las atenciones con tarifa &gt; 0 entran en los lotes de
          liquidación.
        </p>

        {schedules.length === 0 ? (
          <p className="mb-4 text-sm text-slate-500">Sin tarifas cargadas.</p>
        ) : (
          <ul className="mb-4 divide-y divide-slate-100 text-sm">
            {schedules.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="font-medium text-slate-900">{row.insurance_provider}</p>
                  <p className="text-slate-600">
                    {row.practice_code} — {row.practice_label}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{formatOsAmount(row.amount)}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    loading={loading === row.id}
                    onClick={() => handleDelete(row.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleCreate} className="grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2">
          <Select
            name="insurance_provider"
            label="Obra social"
            required
            options={INSURANCE_PROVIDERS.filter((p) => p !== "Particular").map((p) => ({
              value: p,
              label: p,
            }))}
          />
          <Input name="amount" label="Importe consulta ($)" type="number" min="0" step="0.01" required />
          <Input name="practice_code" label="Código práctica" defaultValue="420101" />
          <Input name="practice_label" label="Descripción práctica" defaultValue="Consulta médica" />
          <div className="sm:col-span-2">
            <Button type="submit" loading={loading === "create"}>
              Guardar tarifa
            </Button>
          </div>
        </form>

        {err ? <p className="mt-3 text-sm text-red-700">{err}</p> : null}
        {msg ? <p className="mt-3 text-sm text-emerald-700">{msg}</p> : null}
      </Card>
    </div>
  );
}
