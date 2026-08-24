import {
  COMMERCIAL_SKU_PRICING,
  type CommercialSkuId,
  formatPromoCopyEs,
  isCommercialSkuId,
} from "@/core/billing/commercial-pricing";

/** Purchasable SKUs + historic IDs still parseable from Mercado Pago external_reference. */
export type BillingPlanId = "essential" | "pro" | "solo" | "consultorio" | "clinica";

export type BillingCycle = "monthly" | "annual";

export type BillingPlan = {
  id: BillingPlanId;
  name: string;
  tagline: string;
  /** Promotional / list monthly price (ARS whole units). */
  priceArsMonthly?: number;
  /** Post-promo monthly price (Essential/Pro). */
  priceArsRegular?: number;
  priceArsAnnual?: number;
  /** Sin precio publicado — mostrar badge "En desarrollo". */
  status?: "development" | "legacy";
  professionalsIncluded: string;
  highlights: string[];
  recommended?: boolean;
  mercadoPagoPreferenceSku?: string;
};

/** Public commercial catalog. Legacy Solo/Consultorio/Clínica kept for historic refs only. */
export const DRFLOW_BILLING_PLANS: BillingPlan[] = [
  {
    id: "essential",
    name: COMMERCIAL_SKU_PRICING.essential.displayName,
    tagline: COMMERCIAL_SKU_PRICING.essential.tagline,
    priceArsMonthly: COMMERCIAL_SKU_PRICING.essential.promoPriceArs,
    priceArsRegular: COMMERCIAL_SKU_PRICING.essential.regularPriceArs,
    professionalsIncluded: "1 profesional",
    highlights: [
      "Agenda, pacientes e historia clínica",
      "Recetas y órdenes",
      "5 GB de almacenamiento",
      "Pacientes ilimitados",
      "Soporte por email",
    ],
    mercadoPagoPreferenceSku: "drflow-essential-mensual",
  },
  {
    id: "pro",
    name: COMMERCIAL_SKU_PRICING.pro.displayName,
    tagline: COMMERCIAL_SKU_PRICING.pro.tagline,
    priceArsMonthly: COMMERCIAL_SKU_PRICING.pro.promoPriceArs,
    priceArsRegular: COMMERCIAL_SKU_PRICING.pro.regularPriceArs,
    professionalsIncluded: "Hasta 5 profesionales",
    recommended: true,
    highlights: [
      "Todo Essential + automatización avanzada",
      "IA clínica (hasta 1000 acciones/mes)",
      "25 GB de almacenamiento",
      "Reportes avanzados",
      "Soporte prioritario",
    ],
    mercadoPagoPreferenceSku: "drflow-pro-mensual",
  },
  // Historic SKUs — not sold; kept for webhook external_reference parsing / amount checks.
  {
    id: "solo",
    name: "Solo (histórico)",
    tagline: "Plan histórico — ya no se vende",
    priceArsMonthly: 24_900,
    priceArsAnnual: 249_000,
    status: "legacy",
    professionalsIncluded: "1 profesional",
    highlights: [],
    mercadoPagoPreferenceSku: "drflow-solo-mensual",
  },
  {
    id: "consultorio",
    name: "Consultorio (histórico)",
    tagline: "Plan histórico — ya no se vende",
    priceArsMonthly: 39_900,
    priceArsAnnual: 399_000,
    status: "legacy",
    professionalsIncluded: "Hasta 3 profesionales",
    highlights: [],
    mercadoPagoPreferenceSku: "drflow-consultorio-mensual",
  },
  {
    id: "clinica",
    name: "Clínica (histórico)",
    tagline: "Plan histórico — ya no se vende",
    status: "legacy",
    professionalsIncluded: "Profesionales ilimitados",
    highlights: [],
    mercadoPagoPreferenceSku: "drflow-clinica-mensual",
  },
];

/** Trial gratuito cardless (marketing + enforcement). */
export const TRIAL_DAYS_INCLUDED = 14;

export function formatPlanPriceArs(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function isPlanAvailableForPurchase(plan: BillingPlan): boolean {
  return (
    isCommercialSkuId(plan.id) &&
    plan.status !== "development" &&
    plan.status !== "legacy" &&
    plan.priceArsMonthly != null
  );
}

export function getPublicBillingPlans(): BillingPlan[] {
  return DRFLOW_BILLING_PLANS.filter(isPlanAvailableForPurchase);
}

export function getBillingPlan(planId: BillingPlanId): BillingPlan | undefined {
  return DRFLOW_BILLING_PLANS.find((p) => p.id === planId);
}

/** Catalog list price (promo for commercial; historic for legacy). Used when no snapshot. */
export function getPlanPriceArs(planId: BillingPlanId, cycle: BillingCycle): number | null {
  const plan = getBillingPlan(planId);
  if (!plan) return null;
  if (isCommercialSkuId(planId)) {
    if (cycle === "annual") return null; // commercial cut is monthly only
    return plan.priceArsMonthly ?? null;
  }
  // Historic: allow amount validation even if not purchasable
  if (cycle === "annual") return plan.priceArsAnnual ?? null;
  return plan.priceArsMonthly ?? null;
}

export function getPlanRegularPriceArs(planId: BillingPlanId): number | null {
  const plan = getBillingPlan(planId);
  return plan?.priceArsRegular ?? null;
}

export function getPlanMercadoPagoSku(planId: BillingPlanId, cycle: BillingCycle): string {
  const base = getBillingPlan(planId)?.mercadoPagoPreferenceSku ?? `drflow-${planId}-mensual`;
  if (cycle === "annual") {
    return base.replace(/-mensual$/, "-anual");
  }
  return base;
}

export function billingCycleLabel(cycle: BillingCycle): string {
  return cycle === "annual" ? "Anual" : "Mensual";
}

export function buildPlanSalesMessage(planId: BillingPlanId, clinicName?: string): string {
  const plan = DRFLOW_BILLING_PLANS.find((p) => p.id === planId);
  const label = plan?.name ?? planId;
  const clinic = clinicName?.trim() ? ` — consultorio: ${clinicName.trim()}` : "";
  if (plan?.status === "development") {
    return `Hola, me interesa el plan ${label} de DrFlow (en desarrollo). ¿Cuándo estará disponible?${clinic}`;
  }
  if (isCommercialSkuId(planId)) {
    const copy = formatPromoCopyEs(planId);
    return `Hola, quiero activar ${label} (${copy.currentPromoLine}; ${copy.thenRegularLine})${clinic}.`;
  }
  return `Hola, quiero activar DrFlow plan ${label}${clinic}. ¿Me pasan link de pago?`;
}

export function getSalesContactEmail(): string {
  return process.env.NEXT_PUBLIC_SALES_EMAIL?.trim() || "ventas@opusorg.com";
}

export function getSalesWhatsAppPhone(): string | null {
  const raw = process.env.NEXT_PUBLIC_SALES_WHATSAPP?.trim();
  if (raw) return raw;
  return "5491152591607";
}

export const DRFLOW_SUPPORT_URL = "https://soporte.opusorg.com.ar";

export function formatWhatsAppDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("549") && digits.length >= 12) {
    return `+54 9 ${digits.slice(3, 5)} ${digits.slice(5, 9)}-${digits.slice(9)}`;
  }
  return phone;
}

export type { CommercialSkuId };
