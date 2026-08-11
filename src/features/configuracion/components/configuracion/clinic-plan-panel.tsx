import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";

import {
  DRFLOW_BILLING_PLANS,
  formatPlanPriceArs,
  isPlanAvailableForPurchase,
} from "@/core/billing/plans";
import type { ClinicSubscriptionSummary } from "@/core/billing/subscription-service";
import { MercadoPagoCheckoutButton } from "@/core/components/billing/mercadopago-checkout-button";

import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Props = {
  summary: ClinicSubscriptionSummary;
  paymentNotice?: "ok" | "error" | "pending" | null;
};

export function ClinicPlanPanel({ summary, paymentNotice }: Props) {
  const subscriptionActive =
    summary.subscription != null &&
    (summary.subscription.status === "active" || summary.subscription.status === "manual") &&
    summary.accessActive;

  const purchasablePlans = DRFLOW_BILLING_PLANS.filter(isPlanAvailableForPurchase);

  return (
    <Card
      title="Tu plan DrFlow"
      description="Suscripción del consultorio — activación automática vía Mercado Pago."
    >
      <div className="space-y-4 text-sm">
        {paymentNotice === "ok" ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
            Pago recibido. Si el acceso no se activó al instante, esperá unos segundos y recargá esta
            página.
          </div>
        ) : null}
        {paymentNotice === "pending" ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
            Pago pendiente de confirmación. Te avisaremos por email cuando se acredite.
          </div>
        ) : null}
        {paymentNotice === "error" ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-900">
            El pago no se completó. Podés reintentar abajo o contactar a ventas.
          </div>
        ) : null}

        {subscriptionActive ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
            <p className="font-semibold text-emerald-950">Plan activo</p>
            <p className="mt-1 text-emerald-900">
              {summary.planLabel ?? "DrFlow"} · {summary.cycleLabel ?? "—"}
              {summary.periodEndLabel ? (
                <>
                  <br />
                  Próximo vencimiento: <strong>{summary.periodEndLabel}</strong>
                </>
              ) : null}
            </p>
            {summary.lastPaymentAt ? (
              <p className="mt-2 text-xs text-emerald-800">
                Último pago registrado:{" "}
                {format(new Date(summary.lastPaymentAt), "PPp", { locale: es })}
              </p>
            ) : null}
          </div>
        ) : summary.trialExpired ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-amber-950">Prueba finalizada</p>
            <p className="mt-1 text-amber-900">
              Activá un plan para seguir usando agenda, historias clínicas y recetas.
            </p>
          </div>
        ) : summary.trialDaysRemaining != null ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">Periodo de prueba</p>
            <p className="mt-1 text-slate-700">
              {summary.trialDaysRemaining === 0 ? (
                <>La prueba termina hoy.</>
              ) : (
                <>
                  Quedan <strong>{summary.trialDaysRemaining} días</strong> de prueba gratuita.
                </>
              )}
              {summary.trialEndsAt ? (
                <>
                  {" "}
                  (hasta{" "}
                  {format(new Date(summary.trialEndsAt), "PP", { locale: es })})
                </>
              ) : null}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">Acceso activo</p>
            <p className="mt-1 text-slate-700">Tu consultorio tiene acceso completo a DrFlow.</p>
          </div>
        )}

        {!summary.mercadoPagoConfigured ? (
          <p className="text-slate-600">
            Checkout online próximamente. Mientras tanto,{" "}
            <Link href="/planes" className="font-medium text-teal-700 hover:underline">
              contactá ventas
            </Link>{" "}
            para activar tu plan.
          </p>
        ) : !subscriptionActive ? (
          <div className="space-y-3">
            <p className="font-medium text-slate-900">Activar con Mercado Pago</p>
            {purchasablePlans.map((plan) => (
              <div
                key={plan.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{plan.name}</p>
                    <p className="text-xs text-slate-600">{plan.tagline}</p>
                    {plan.priceArsMonthly != null ? (
                      <p className="mt-1 text-sm text-slate-800">
                        {formatPlanPriceArs(plan.priceArsMonthly)}/mes
                        {plan.priceArsAnnual != null ? (
                          <span className="text-slate-500">
                            {" "}
                            · Anual {formatPlanPriceArs(plan.priceArsAnnual)}
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex min-w-[12rem] flex-col gap-2">
                    <MercadoPagoCheckoutButton planId={plan.id} cycle="monthly" />
                    {plan.priceArsAnnual != null ? (
                      <MercadoPagoCheckoutButton
                        planId={plan.id}
                        cycle="annual"
                        label="Pagar plan anual"
                        variant="outline"
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/planes" variant="outline" size="sm">
              Ver todos los planes
            </ButtonLink>
          </div>
        )}
      </div>
    </Card>
  );
}
