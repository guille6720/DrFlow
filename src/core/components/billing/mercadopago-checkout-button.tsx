"use client";

import { CreditCard, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import type { BillingCycle, BillingPlanId } from "@/core/billing/plans";
import { toast } from "@/core/notifications/toast";

import { Button } from "@/components/ui/button";
import { startMercadoPagoCheckout } from "@/lib/actions/billing";

type MercadoPagoCheckoutButtonProps = {
  planId: BillingPlanId;
  cycle?: BillingCycle;
  label?: string;
  className?: string;
  variant?: "primary" | "outline";
  disabled?: boolean;
  requiresLogin?: boolean;
};

export function MercadoPagoCheckoutButton({
  planId,
  cycle = "monthly",
  label = "Pagar con Mercado Pago",
  className,
  variant = "primary",
  disabled = false,
  requiresLogin = false,
}: MercadoPagoCheckoutButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (requiresLogin) {
      window.location.href = `/login?redirect=${encodeURIComponent(`/planes?plan=${planId}&cycle=${cycle}`)}`;
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await startMercadoPagoCheckout(planId, cycle);
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      window.location.href = result.initPoint;
    });
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant={variant}
        className="w-full gap-2"
        disabled={disabled || pending}
        onClick={handleClick}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CreditCard className="h-4 w-4" aria-hidden />}
        {pending ? "Redirigiendo…" : label}
      </Button>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
