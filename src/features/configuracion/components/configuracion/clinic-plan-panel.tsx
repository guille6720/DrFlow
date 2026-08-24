import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";

import { formatPromoCopyEs, isCommercialSkuId } from "@/core/billing/commercial-pricing";
import {
  formatPlanPriceArs,
  getPublicBillingPlans,
  isPlanAvailableForPurchase,
} from "@/core/billing/plans";
import type { ClinicSubscriptionSummary } from "@/core/billing/subscription-service";
import {
  CONSUMER_RIGHTS_LEGAL_REVIEW,
  subscriptionGrantsAccess,
} from "@/core/compliance/cancellation-consumer-rights";
import { CancelSubscriptionButton } from "@/core/components/billing/cancel-subscription-button";
import { MercadoPagoCheckoutButton } from "@/core/components/billing/mercadopago-checkout-button";
import { ClinicUpgradeHintCard } from "@/core/components/entitlements/clinic-upgrade-hint-card";

import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Props = {
  summary: ClinicSubscriptionSummary;
  paymentNotice?: "ok" | "error" | "pending" | null;
  commercialPlanKey?: string | null;
  commercialStatus?: string | null;
  commercialTrialEndsAt?: string | null;
  commercialQuotas?: { label: string; value: string }[];
  commercialModules?: {
    included: { key: string; label: string }[];
    excluded: { key: string; label: string }[];
  };
};

export function ClinicPlanPanel({
  summary,
  paymentNotice,
  commercialPlanKey,
  commercialStatus,
  commercialTrialEndsAt,
  commercialQuotas,
  commercialModules,
}: Props) {
  const subscriptionActive = subscriptionGrantsAccess({
    status: summary.subscription?.status,
    currentPeriodEnd: summary.subscription?.current_period_end,
  });
  const isCanceled = summary.subscription?.status === "canceled";
  const canSelfServeCancel =
    summary.subscription != null &&
    (summary.subscription.status === "active" ||
      summary.subscription.status === "past_due" ||
      summary.subscription.status === "trialing");

  const purchasablePlans = getPublicBillingPlans().filter(isPlanAvailableForPurchase);
  const currentPlanId = summary.subscription?.plan_id;
  const canUpgradeToPro = subscriptionActive && currentPlanId === "essential";

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

        {commercialPlanKey ? (
          <p className="text-xs text-slate-500">
            Catálogo comercial: <span className="font-medium text-slate-700">{commercialPlanKey}</span>
            {commercialStatus ? (
              <>
                {" "}
                · estado <span className="font-medium text-slate-700">{commercialStatus}</span>
              </>
            ) : null}
            {commercialTrialEndsAt ? (
              <>
                {" "}
                · prueba comercial hasta{" "}
                <span className="font-medium text-slate-700">
                  {format(new Date(commercialTrialEndsAt), "PPp", { locale: es })}
                </span>
              </>
            ) : null}
          </p>
        ) : null}

        {commercialQuotas && commercialQuotas.length > 0 ? (
          <ul className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {commercialQuotas.map((row) => (
              <li key={row.label} className="flex justify-between gap-3 py-0.5">
                <span>{row.label}</span>
                <span className="font-medium text-slate-900">{row.value}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {commercialModules &&
        (commercialModules.included.length > 0 || commercialModules.excluded.length > 0) ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {commercialModules.included.length > 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  Incluido
                </p>
                <ul className="mt-2 space-y-1 text-sm text-emerald-950">
                  {commercialModules.included.map((row) => (
                    <li key={row.key}>{row.label}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {commercialModules.excluded.length > 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  No incluido
                </p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {commercialModules.excluded.map((row) => (
                    <li key={row.key}>{row.label}</li>
                  ))}
                </ul>
                <Link href="/planes" className="mt-2 inline-block text-xs font-medium text-teal-700 hover:underline">
                  Ver planes
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}

        {subscriptionActive || isCanceled ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
            <p className="font-semibold text-emerald-950">
              {isCanceled ? "Plan cancelado (acceso hasta vencimiento)" : "Plan activo"}
            </p>
            <p className="mt-1 text-emerald-900">
              {summary.planLabel ?? "DrFlow"} · {summary.cycleLabel ?? "—"}
              {summary.periodEndLabel ? (
                <>
                  <br />
                  {isCanceled ? "Acceso hasta" : "Próximo vencimiento"}:{" "}
                  <strong>{summary.periodEndLabel}</strong>
                </>
              ) : null}
            </p>
            {summary.effectivePriceArs != null ? (
              <p className="mt-2 text-sm text-emerald-900">
                Precio actual: <strong>{formatPlanPriceArs(summary.effectivePriceArs)}/mes</strong>
                {summary.pricePhase === "promotional" ? " (promoción activa)" : null}
                {summary.pricePhase === "regular" ? " (precio regular)" : null}
                {summary.promoEndsLabel && summary.pricePhase === "promotional" ? (
                  <>
                    <br />
                    Promoción hasta: <strong>{summary.promoEndsLabel}</strong>
                  </>
                ) : null}
                {summary.nextChargeArs != null ? (
                  <>
                    <br />
                    Próximo monto estimado:{" "}
                    <strong>{formatPlanPriceArs(summary.nextChargeArs)}</strong>
                  </>
                ) : null}
              </p>
            ) : null}
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
            {purchasablePlans.map((plan) => {
              const promo = isCommercialSkuId(plan.id) ? formatPromoCopyEs(plan.id) : null;
              return (
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
                          {promo ? (
                            <span className="block text-xs text-teal-800">{promo.currentPromoLine}</span>
                          ) : null}
                          {plan.priceArsRegular != null ? (
                            <span className="block text-xs text-slate-500">
                              Luego {formatPlanPriceArs(plan.priceArsRegular)}/mes
                            </span>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex min-w-[12rem] flex-col gap-2">
                      <MercadoPagoCheckoutButton planId={plan.id} cycle="monthly" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {canUpgradeToPro ? (
              <div className="rounded-xl border border-teal-200 bg-teal-50/80 p-4">
                <p className="font-semibold text-teal-950">Pasá a Pro</p>
                <p className="mt-1 text-sm text-teal-900">
                  Conservás tu ventana promocional actual. No se reinician los 6 meses.
                </p>
                <div className="mt-3 max-w-xs">
                  <MercadoPagoCheckoutButton
                    planId="pro"
                    cycle="monthly"
                    label="Actualizar a Pro"
                  />
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/planes" variant="outline" size="sm">
                Ver todos los planes
              </ButtonLink>
            </div>
            {canSelfServeCancel || isCanceled ? (
              <CancelSubscriptionButton
                periodEndLabel={summary.periodEndLabel}
                alreadyCanceled={isCanceled}
              />
            ) : null}
            <p className="text-xs text-slate-500">
              Baja del servicio disponible arriba. Derecho de arrepentimiento u otras normas de
              consumo: {CONSUMER_RIGHTS_LEGAL_REVIEW}.
            </p>
          </div>
        )}
      </div>
      <ClinicUpgradeHintCard />
    </Card>
  );
}
