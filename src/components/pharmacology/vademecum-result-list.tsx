"use client";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { PamiVademecumResult } from "@/types/pharmacology";
import { AlertTriangle, Loader2, Pill } from "lucide-react";

interface VademecumResultListProps {
  items: PamiVademecumResult[];
  loading: boolean;
  error: string | null;
  queryLength: number;
}

function formatMoney(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(value);
}

export function VademecumResultList({
  items,
  loading,
  error,
  queryLength,
}: VademecumResultListProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-16">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <p className="mt-3 text-sm text-slate-500">Buscando en vademécum PAMI...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
        <p className="mt-2 text-sm font-medium text-red-800">{error}</p>
      </div>
    );
  }

  if (queryLength < 2) {
    return (
      <EmptyState
        icon={Pill}
        title="Vademécum PAMI / Alfabeta"
        description="Buscá por marca comercial, principio activo, laboratorio o código Alfabeta. Se muestran precio PAMI, cobertura e importe afiliado."
        className="bg-white"
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Pill}
        title="Sin productos"
        description="No encontramos productos en el vademécum para esa búsqueda."
        className="bg-white"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-900">
        <strong>Referencia PAMI:</strong> Precios y coberturas según lista importada. Verificá vigencia,
        autorizaciones y formularios antes de prescribir.
      </div>

      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-800">{items.length} producto(s)</h3>
        </div>
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{item.brand_name}</p>
                  <p className="text-sm text-slate-600">{item.active_ingredient}</p>
                  <p className="mt-1 text-sm text-slate-700">{item.presentation}</p>
                  {item.laboratory ? (
                    <p className="mt-1 text-xs text-slate-500">{item.laboratory}</p>
                  ) : null}
                </div>
                <Badge variant="teal" className="font-mono text-xs">
                  Alfabeta {item.alfabeta_id}
                </Badge>
              </div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    PVP PAMI
                  </span>
                  <p className="font-medium text-slate-800">{formatMoney(item.pvp_amount)}</p>
                </div>
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Cobertura
                  </span>
                  <p className="font-medium text-slate-800">
                    {item.coverage_pct != null ? `${item.coverage_pct}%` : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Importe afiliado
                  </span>
                  <p className="font-medium text-slate-800">{formatMoney(item.affiliate_amount)}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
