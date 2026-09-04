import { BRAND_NAME, BRAND_SEO_DESCRIPTION } from "@/core/brand/brand";
import { getPublicSiteUrl } from "@/core/supabase/env";

/** Organization JSON-LD for homepage SEO. */
export function MarketingJsonLd() {
  const url = getPublicSiteUrl();

  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: BRAND_NAME,
    applicationCategory: "HealthApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "ARS",
    },
    url,
    description: BRAND_SEO_DESCRIPTION,
    inLanguage: "es-AR",
    publisher: {
      "@type": "Organization",
      name: BRAND_NAME,
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
