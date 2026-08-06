import { CheckCircle2, MessageCircle, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  type BillingPlanId,
  buildPlanSalesMessage,
  DRFLOW_BILLING_PLANS,
  formatPlanPriceArs,
  getSalesContactEmail,
  getSalesWhatsAppPhone,
  TRIAL_DAYS_INCLUDED,
} from "@/core/billing/plans";
import { DrFlowLogo } from "@/core/components/brand/drflow-logo";

import { buildWhatsAppShareUrl, buildWhatsAppUrl } from "@/shared/utils/whatsapp";

import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Planes y precios | DrFlow",
  description:
    "Planes DrFlow para consultorios en Argentina. Prueba 10 días gratis. Agenda, HC, recetas PAMI y app paciente.",
  openGraph: {
    title: "Planes DrFlow — consultorios Argentina",
    url: "https://drflow.opusorg.com/planes",
    siteName: "DrFlow",
    locale: "es_AR",
    type: "website",
  },
};

const FAQ = [
  {
    q: "¿Puedo probar antes de pagar?",
    a: `Sí. ${TRIAL_DAYS_INCLUDED} días gratis sin tarjeta en /probar. Tus datos se conservan si activás un plan.`,
  },
  {
    q: "¿Cómo pago hoy?",
    a: "Por ahora: contacto comercial (WhatsApp o email) y te enviamos link de Mercado Pago. El checkout automático en la app está en roadmap (Fase 2).",
  },
  {
    q: "¿Incluye receta electrónica REFEPS?",
    a: "No. DrFlow emite recetas locales con disclaimer Ley 25.649. REFEPS nacional es roadmap separado.",
  },
  {
    q: "¿Facturación AFIP?",
    a: "Emitimos factura por el servicio SaaS al activar. Detalle fiscal según tu condición impositiva.",
  },
];

function planWhatsAppHref(planId: BillingPlanId): string {
  const message = buildPlanSalesMessage(planId);
  const phone = getSalesWhatsAppPhone();
  if (phone) {
    return buildWhatsAppUrl(phone, message) ?? buildWhatsAppShareUrl(message);
  }
  return buildWhatsAppShareUrl(message);
}

export default function PlanesPage() {
  const salesEmail = getSalesContactEmail();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50/40">
      <header className="border-b border-slate-200 bg-white/90 px-4 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <DrFlowLogo size="md" href="/" />
          <nav className="flex gap-2 text-sm">
            <Link href="/probar" className="text-blue-700 hover:underline">
              Probar gratis
            </Link>
            <Link href="/login" className="text-slate-600 hover:underline">
              Ingresar
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Planes para consultorios
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Elegí el plan para tu consultorio
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-slate-600">
            Precios en pesos argentinos, facturación mensual o anual. Empezá con{" "}
            {TRIAL_DAYS_INCLUDED} días gratis — sin tarjeta.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/register?trial=10" size="lg">
              Empezar prueba gratis
            </ButtonLink>
            <ButtonLink href={`mailto:${salesEmail}?subject=Consulta%20planes%20DrFlow`} variant="outline" size="lg">
              Escribinos
            </ButtonLink>
          </div>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {DRFLOW_BILLING_PLANS.map((plan) => (
            <article
              key={plan.id}
              className={
                plan.recommended
                  ? "relative rounded-2xl border-2 border-blue-500 bg-white p-6 shadow-lg shadow-blue-500/10"
                  : "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              }
            >
              {plan.recommended ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold text-white">
                  Recomendado
                </span>
              ) : null}
              <h2 className="text-xl font-bold text-slate-900">{plan.name}</h2>
              <p className="mt-1 text-sm text-slate-600">{plan.tagline}</p>
              <p className="mt-4 text-3xl font-bold text-slate-900">
                {formatPlanPriceArs(plan.priceArsMonthly)}
                <span className="text-base font-normal text-slate-500"> / mes</span>
              </p>
              <p className="text-xs text-slate-500">
                Anual {formatPlanPriceArs(plan.priceArsAnnual)} (2 meses bonificados)
              </p>
              <p className="mt-2 text-sm font-medium text-blue-800">{plan.professionalsIncluded}</p>
              <ul className="mt-4 space-y-2">
                {plan.highlights.map((h) => (
                  <li key={h} className="flex gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    {h}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-col gap-2">
                <a
                  href={planWhatsAppHref(plan.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
                >
                  <MessageCircle className="h-4 w-4" />
                  Activar por WhatsApp
                </a>
                <ButtonLink href="/register?trial=10" variant="outline" className="w-full">
                  Probar {TRIAL_DAYS_INCLUDED} días gratis
                </ButtonLink>
              </div>
            </article>
          ))}
        </div>

        <section className="mt-14 rounded-2xl border border-violet-200 bg-violet-50/60 p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-6 w-6 shrink-0 text-violet-700" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Roadmap de pago automático</h2>
              <p className="mt-2 text-sm text-slate-700">
                <strong>Fase 1 (ahora):</strong> activación manual vía WhatsApp + link Mercado Pago que
                te enviamos. <strong>Fase 2:</strong> checkout en /planes con webhook MP → desbloqueo
                instantáneo. Ver detalle técnico en{" "}
                <code className="rounded bg-white/80 px-1 text-xs">docs/MONETIZACION-PLAN.md</code>.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-bold text-slate-900">Preguntas frecuentes</h2>
          <dl className="mt-4 space-y-4">
            {FAQ.map((item) => (
              <div key={item.q} className="rounded-xl border border-slate-200 bg-white p-4">
                <dt className="font-medium text-slate-900">{item.q}</dt>
                <dd className="mt-1 text-sm text-slate-600">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="mt-10 text-center text-xs text-slate-500">
          Consultas comerciales:{" "}
          <a href={`mailto:${salesEmail}`} className="text-blue-700 hover:underline">
            {salesEmail}
          </a>
          {" · "}
          <Link href="/terminos" className="hover:underline">
            Términos
          </Link>
          {" · "}
          <Link href="/privacidad" className="hover:underline">
            Privacidad
          </Link>
        </p>
      </main>
    </div>
  );
}
