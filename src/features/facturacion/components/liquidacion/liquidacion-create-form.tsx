"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createOsLiquidationBatch } from "@/lib/actions/os-liquidacion";
import { INSURANCE_PROVIDERS } from "@/lib/constants/coverages";

export function LiquidacionCreateForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = format(new Date(), "yyyy-MM-dd");
  const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await createOsLiquidationBatch(fd);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.batchId) {
      router.push(`/facturacion/liquidacion/${result.batchId}`);
      router.refresh();
    }
  }

  return (
    <Card title="Nuevo lote de liquidación">
      <p className="mb-4 text-sm text-slate-600">
        Se incluyen atenciones con estado <strong>Atendido</strong> cuya cobertura coincide con la obra social
        elegida y tienen tarifa configurada. Los copagos cobrados en caja se restan al exportar.
      </p>
      <form onSubmit={handleSubmit} className="grid max-w-xl gap-4">
        <Select
          name="insurance_provider"
          label="Obra social / prepaga"
          required
          options={INSURANCE_PROVIDERS.filter((p) => p !== "Particular").map((p) => ({
            value: p,
            label: p,
          }))}
        />
        <Input name="period_from" label="Desde" type="date" defaultValue={monthStart} required />
        <Input name="period_to" label="Hasta" type="date" defaultValue={today} required />
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" loading={loading}>
            Crear lote
          </Button>
          <Link href="/facturacion/liquidacion">
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
