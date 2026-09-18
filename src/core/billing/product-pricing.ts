/**
 * Product-level commercial pricing (Clínica / Geriatría / Combo).
 * Centralized — do not hardcode in clinical UI components.
 * Checkout automático de Geriatría: NO activado (requiere Superadmin).
 */

export const PRODUCT_PROMO_BILLING_MONTHS = 6 as const;

export type PlatformProductSkuId = "geriatrics" | "clinic_geriatrics_bundle";

export type PlatformProductPricing = {
  id: PlatformProductSkuId;
  displayName: string;
  tagline: string;
  promoPriceArs: number | null;
  regularPriceArs: number;
  promoMonths: typeof PRODUCT_PROMO_BILLING_MONTHS | null;
  currency: "ARS";
  includedResidentsMax: number | null;
  features: string[];
  cta: "request_demo" | "contact_sales";
  autoCheckout: false;
};

export const PLATFORM_PRODUCT_PRICING: Record<PlatformProductSkuId, PlatformProductPricing> = {
  geriatrics: {
    id: "geriatrics",
    displayName: "Geriatría",
    tagline: "Gestión integral para residencias y cuidados geriátricos.",
    promoPriceArs: 59_000,
    regularPriceArs: 79_000,
    promoMonths: PRODUCT_PROMO_BILLING_MONTHS,
    currency: "ARS",
    includedResidentsMax: 30,
    features: [
      "Residentes e historia clínica",
      "Habitaciones y camas",
      "Enfermería por turnos",
      "Administración de medicamentos",
      "Planes de cuidados",
      "Evoluciones multidisciplinarias",
      "Nutrición",
      "Incidentes y caídas",
      "Familiares y responsables",
      "Traslados y estudios",
      "Reportes",
      "Auditoría clínica",
    ],
    cta: "request_demo",
    autoCheckout: false,
  },
  clinic_geriatrics_bundle: {
    id: "clinic_geriatrics_bundle",
    displayName: "Clínica + Geriatría",
    tagline:
      "Solución integral para instituciones con atención ambulatoria y residencia geriátrica.",
    promoPriceArs: null,
    regularPriceArs: 99_000,
    promoMonths: null,
    currency: "ARS",
    includedResidentsMax: null,
    features: [
      "Todo el módulo Clínica",
      "Todo el módulo Geriatría",
      "Identidad única de paciente/residente",
      "Auditoría y multi-tenant",
    ],
    cta: "request_demo",
    autoCheckout: false,
  },
};

export function formatProductPriceArs(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getGeriatricsDemoMessage(): string {
  return (
    "Hola, quiero solicitar una demo del módulo Geriatría de DrFlow " +
    `(promo ${formatProductPriceArs(59_000)}/mes × 6 meses, luego ${formatProductPriceArs(79_000)}/mes, hasta 30 residentes).`
  );
}

export function getClinicGeriatricsBundleDemoMessage(): string {
  return (
    "Hola, quiero información sobre Clínica + Geriatría de DrFlow " +
    `(${formatProductPriceArs(99_000)}/mes).`
  );
}
