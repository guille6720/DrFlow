"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { type ProductKey, productLabel, PRODUCTS } from "@/core/products/products";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { setClinicProductAction } from "@/lib/actions/superadmin-products";

type Props = {
  clinicId: string;
  clinicEnabled: boolean;
  geriatricsEnabled: boolean;
  catalogAvailable: boolean;
};

export function SuperadminClinicProductsForm({
  clinicId,
  clinicEnabled,
  geriatricsEnabled,
  catalogAvailable,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(productKey: ProductKey, next: boolean) {
    setMessage(null);
    setError(null);
    const fd = new FormData();
    fd.set("clinicId", clinicId);
    fd.set("productKey", productKey);
    fd.set("enabled", next ? "true" : "false");
    fd.set("reason", "superadmin_ui");
    startTransition(async () => {
      const result = await setClinicProductAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        `${productLabel(productKey)} ${result.enabled ? "activado" : "desactivado"} (antes: ${
          result.previousEnabled ? "ON" : "OFF"
        }).`
      );
      router.refresh();
    });
  }

  return (
    <Card
      title="Productos habilitados"
      description="Solo Superadmin. Independiente del plan comercial. Los cambios quedan auditados."
    >
      {!catalogAvailable ? (
        <p className="mb-3 text-sm text-amber-800 dark:text-amber-200">
          Catálogo de productos no disponible en esta base (migración 158 pendiente). No se pueden
          persistir cambios todavía.
        </p>
      ) : null}
      <div className="space-y-3">
        <ProductRow
          label="Clínica"
          enabled={clinicEnabled}
          disabled={pending || !catalogAvailable}
          onChange={(v) => toggle(PRODUCTS.CLINIC, v)}
        />
        <ProductRow
          label="Geriatría"
          enabled={geriatricsEnabled}
          disabled={pending || !catalogAvailable}
          onChange={(v) => toggle(PRODUCTS.GERIATRICS, v)}
        />
      </div>
      {message ? <p className="mt-3 text-sm text-teal-800 dark:text-teal-200">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
    </Card>
  );
}

function ProductRow({
  label,
  enabled,
  disabled,
  onChange,
}: {
  label: string;
  enabled: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
      <div>
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</p>
        <p className="text-xs text-slate-500">{enabled ? "ON" : "OFF"}</p>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={enabled ? "primary" : "secondary"}
          disabled={disabled || enabled}
          onClick={() => onChange(true)}
        >
          Activar
        </Button>
        <Button
          type="button"
          size="sm"
          variant={!enabled ? "primary" : "secondary"}
          disabled={disabled || !enabled}
          onClick={() => onChange(false)}
        >
          Desactivar
        </Button>
      </div>
    </div>
  );
}
