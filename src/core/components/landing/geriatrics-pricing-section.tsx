import { CheckCircle2, MessageCircle } from "lucide-react";

import { getSalesWhatsAppPhone } from "@/core/billing/plans";
import {
  formatProductPriceArs,
  getClinicGeriatricsBundleDemoMessage,
  getGeriatricsDemoMessage,
  PLATFORM_PRODUCT_PRICING,
} from "@/core/billing/product-pricing";

import { buildWhatsAppShareUrl, buildWhatsAppUrl } from "@/shared/utils/whatsapp";

function demoHref(message: string): string {
  const phone = getSalesWhatsAppPhone();
  if (phone) {
    return buildWhatsAppUrl(phone, message) ?? buildWhatsAppShareUrl(message);
  }
  return buildWhatsAppShareUrl(message);
}

export function GeriatricsPricingSection({ className }: { className?: string }) {
  const geri = PLATFORM_PRODUCT_PRICING.geriatrics;
  const bundle = PLATFORM_PRODUCT_PRICING.clinic_geriatrics_bundle;

  return (
    <section id="geriatria" className={className}>
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">Productos</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Geriatría para residencias
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">
          Módulo independiente. La habilitación la realiza el Superadmin — sin contratación automática.
        </p>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border-2 border-teal-500 bg-white p-6 shadow-xl shadow-teal-500/10">
          <h3 className="text-xl font-bold text-slate-900">{geri.displayName}</h3>
          <p className="mt-1 text-sm text-slate-600">{geri.tagline}</p>
          <p className="mt-4 text-3xl font-bold text-slate-900">
            {formatProductPriceArs(geri.promoPriceArs!)}
            <span className="text-base font-normal text-slate-500"> / mes</span>
          </p>
          <p className="mt-1 text-sm text-teal-800">
            Durante los primeros {geri.promoMonths} meses
          </p>
          <p className="text-sm text-slate-500">
            Luego {formatProductPriceArs(geri.regularPriceArs)} / mes
          </p>
          <p className="mt-2 text-sm font-medium text-teal-800">
            Hasta {geri.includedResidentsMax} residentes activos
          </p>
          <ul className="mt-4 space-y-2">
            {geri.features.map((f) => (
              <li key={f} className="flex gap-2 text-sm text-slate-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                {f}
              </li>
            ))}
          </ul>
          <a
            href={demoHref(getGeriatricsDemoMessage())}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
          >
            <MessageCircle className="h-4 w-4" />
            Solicitar demo
          </a>
          <p className="mt-3 text-center text-xs text-slate-500">
            ¿Necesitás más de 30 residentes? Consultanos por planes institucionales.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900">{bundle.displayName}</h3>
          <p className="mt-1 text-sm text-slate-600">{bundle.tagline}</p>
          <p className="mt-4 text-3xl font-bold text-slate-900">
            {formatProductPriceArs(bundle.regularPriceArs)}
            <span className="text-base font-normal text-slate-500"> / mes</span>
          </p>
          <ul className="mt-4 space-y-2">
            {bundle.features.map((f) => (
              <li key={f} className="flex gap-2 text-sm text-slate-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                {f}
              </li>
            ))}
          </ul>
          <a
            href={demoHref(getClinicGeriatricsBundleDemoMessage())}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
          >
            <MessageCircle className="h-4 w-4" />
            Solicitar demo
          </a>
        </article>
      </div>
    </section>
  );
}
