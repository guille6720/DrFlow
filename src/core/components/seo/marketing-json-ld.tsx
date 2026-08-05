import { getPublicSiteUrl } from "@/core/supabase/env";

/** Organization JSON-LD for homepage SEO. */
export function MarketingJsonLd() {
  const url = getPublicSiteUrl();

  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "DrFlow",
    applicationCategory: "HealthApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "ARS",
    },
    url,
    description:
      "Gestión clínica para consultorios argentinos: agenda, historia clínica, recetas y app para pacientes.",
    inLanguage: "es-AR",
    publisher: {
      "@type": "Organization",
      name: "DrFlow",
      url,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
