import type { Metadata } from "next";

import { getSession } from "@/core/auth/session.server";
import { isMercadoPagoConfigured } from "@/core/billing/mercadopago";
import {
  formatWhatsAppDisplay,
  getSalesContactEmail,
  getSalesWhatsAppPhone,
  TRIAL_DAYS_INCLUDED,
} from "@/core/billing/plans";
import { MarketingFooter } from "@/core/components/landing/marketing-footer";
import { MarketingHeader } from "@/core/components/landing/marketing-header";
import { PlansPricingSection } from "@/core/components/landing/plans-pricing-section";

import { buildWhatsAppUrl } from "@/shared/utils/whatsapp";

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

export default async function PlanesPage() {
  const salesEmail = getSalesContactEmail();
  const phone = getSalesWhatsAppPhone();
  const session = await getSession();
  const mercadoPagoEnabled = isMercadoPagoConfigured();
  const salesWhatsAppHref =
    phone && buildWhatsAppUrl(phone, "Hola, quiero consultar planes DrFlow.")
      ? buildWhatsAppUrl(phone, "Hola, quiero consultar planes DrFlow.")
      : null;

  return (
    <div className="min-h-screen drflow-marketing drflow-marketing-site">
      <MarketingHeader />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <div className="mb-10 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/register?trial=10" size="lg">
            Empezar prueba gratis
          </ButtonLink>
          <ButtonLink href={`mailto:${salesEmail}?subject=Consulta%20planes%20DrFlow`} variant="outline" size="lg">
            Escribinos
          </ButtonLink>
        </div>
        <PlansPricingSection
          mercadoPagoEnabled={mercadoPagoEnabled}
          isAuthenticated={Boolean(session)}
        />
        <p className="mt-10 text-center text-xs text-slate-500">
          Consultas comerciales:{" "}
          <a href={`mailto:${salesEmail}`} className="text-teal-700 hover:underline">
            {salesEmail}
          </a>
          {phone && salesWhatsAppHref ? (
            <>
              {" · "}
              <a
                href={salesWhatsAppHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-700 hover:underline"
              >
                WhatsApp {formatWhatsAppDisplay(phone)}
              </a>
            </>
          ) : null}
          {" · "}
          {TRIAL_DAYS_INCLUDED} días de prueba sin tarjeta
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}
