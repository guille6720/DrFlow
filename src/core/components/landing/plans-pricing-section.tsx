import { CheckCircle2, MessageCircle } from "lucide-react";

import { formatPromoCopyEs, isCommercialSkuId } from "@/core/billing/commercial-pricing";
import {
  type BillingPlanId,
  buildPlanSalesMessage,
  formatPlanPriceArs,
  getPublicBillingPlans,
  getSalesWhatsAppPhone,
  isPlanAvailableForPurchase,
  TRIAL_DAYS_INCLUDED,
} from "@/core/billing/plans";
import { MercadoPagoCheckoutButton } from "@/core/components/billing/mercadopago-checkout-button";

import { buildWhatsAppShareUrl, buildWhatsAppUrl } from "@/shared/utils/whatsapp";

import { ButtonLink } from "@/components/ui/button";

function planWhatsAppHref(planId: BillingPlanId): string {
  const message = buildPlanSalesMessage(planId);
  const phone = getSalesWhatsAppPhone();
  if (phone) {
    return buildWhatsAppUrl(phone, message) ?? buildWhatsAppShareUrl(message);
  }
  return buildWhatsAppShareUrl(message);
}

type PlansPricingSectionProps = {
  showHeading?: boolean;
  className?: string;
  mercadoPagoEnabled?: boolean;
  isAuthenticated?: boolean;
};

export function PlansPricingSection({
  showHeading = true,
  className,
  mercadoPagoEnabled = false,
  isAuthenticated = false,
}: PlansPricingSectionProps) {
  const plans = getPublicBillingPlans();

  return (
    <section id="planes" className={className}>
      {showHeading ? (
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">
            Planes y precios
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Essential y Pro para tu consultorio
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-600">
            Precios promocionales por 6 meses, luego precio regular. Empezá con{" "}
            {TRIAL_DAYS_INCLUDED} días gratis — sin tarjeta.
          </p>
        </div>
      ) : null}

      <div className="mt-10 grid gap-6 md:grid-cols-2 md:max-w-4xl md:mx-auto">
        {plans.map((plan) => {
          const available = isPlanAvailableForPurchase(plan);
          const promoCopy = isCommercialSkuId(plan.id) ? formatPromoCopyEs(plan.id) : null;

          return (
            <article
              key={plan.id}
              className={
                plan.recommended
                  ? "relative rounded-2xl border-2 border-teal-500 bg-white p-6 shadow-xl shadow-teal-500/10 ring-1 ring-teal-500/20"
                  : "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              }
            >
              {plan.recommended ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full drflow-accent-fill px-3 py-0.5 text-xs font-semibold text-white">
                  Recomendado
                </span>
              ) : null}
              <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
              <p className="mt-1 text-sm text-slate-600">{plan.tagline}</p>
              {available && plan.priceArsMonthly != null ? (
                <>
                  <p className="mt-4 text-3xl font-bold text-slate-900">
                    {formatPlanPriceArs(plan.priceArsMonthly)}
                    <span className="text-base font-normal text-slate-500"> / mes</span>
                  </p>
                  {promoCopy ? (
                    <p className="mt-1 text-sm text-teal-800">{promoCopy.currentPromoLine}</p>
                  ) : null}
                  {plan.priceArsRegular != null ? (
                    <p className="text-sm text-slate-500">
                      Luego {formatPlanPriceArs(plan.priceArsRegular)}/mes
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-4 text-lg font-semibold text-slate-500">Próximamente</p>
              )}
              <p className="mt-2 text-sm font-medium text-teal-800">{plan.professionalsIncluded}</p>
              <ul className="mt-4 space-y-2">
                {plan.highlights.map((h) => (
                  <li key={h} className="flex gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                    {h}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-col gap-2">
                {available && mercadoPagoEnabled ? (
                  <MercadoPagoCheckoutButton
                    planId={plan.id}
                    cycle="monthly"
                    requiresLogin={!isAuthenticated}
                  />
                ) : null}
                <a
                  href={planWhatsAppHref(plan.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={
                    available
                      ? "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-900 transition-colors hover:bg-emerald-100"
                      : "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  }
                >
                  <MessageCircle className="h-4 w-4" />
                  {available ? "Activar por WhatsApp" : "Consultar disponibilidad"}
                </a>
                {available ? (
                  <ButtonLink href="/register?trial=14" variant="outline" className="w-full">
                    Probar {TRIAL_DAYS_INCLUDED} días gratis
                  </ButtonLink>
                ) : (
                  <ButtonLink href="/probar" variant="outline" className="w-full">
                    Probar {TRIAL_DAYS_INCLUDED} días gratis
                  </ButtonLink>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
