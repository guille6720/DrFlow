export type BillingPlanId = "solo" | "consultorio" | "clinica";

export type BillingPlan = {
  id: BillingPlanId;
  name: string;
  tagline: string;
  priceArsMonthly: number;
  priceArsAnnual: number;
  professionalsIncluded: string;
  highlights: string[];
  recommended?: boolean;
  mercadoPagoPreferenceSku?: string;
};

/** Precios orientativos AR — ajustá antes de cobrar. Anual = 10 meses (≈17% off). */
export const DRFLOW_BILLING_PLANS: BillingPlan[] = [
  {
    id: "solo",
    name: "Solo",
    tagline: "Un médico, consultorio chico",
    priceArsMonthly: 29_900,
    priceArsAnnual: 299_000,
    professionalsIncluded: "1 profesional",
    highlights: [
      "Agenda, HC, recetas y órdenes PAMI",
      "App paciente + turnos online",
      "1 usuario médico",
      "Soporte por email",
    ],
    mercadoPagoPreferenceSku: "drflow-solo-mensual",
  },
  {
    id: "consultorio",
    name: "Consultorio",
    tagline: "Médico + secretaría + equipo chico",
    priceArsMonthly: 49_900,
    priceArsAnnual: 499_000,
    professionalsIncluded: "Hasta 3 profesionales",
    recommended: true,
    highlights: [
      "Todo Solo + caja y sala de espera",
      "Usuarios invitados (médico / secretaría)",
      "Permisos por miembro",
      "Dictado por voz e IA clínica",
    ],
    mercadoPagoPreferenceSku: "drflow-consultorio-mensual",
  },
  {
    id: "clinica",
    name: "Clínica",
    tagline: "Varios médicos, operación completa",
    priceArsMonthly: 79_900,
    priceArsAnnual: 799_000,
    professionalsIncluded: "Profesionales ilimitados",
    highlights: [
      "Todo Consultorio sin límite de médicos",
      "Reportes, importación de datos",
      "Prioridad en soporte",
      "Onboarding asistido",
    ],
    mercadoPagoPreferenceSku: "drflow-clinica-mensual",
  },
];

export const TRIAL_DAYS_INCLUDED = 10;

export function formatPlanPriceArs(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function buildPlanSalesMessage(planId: BillingPlanId, clinicName?: string): string {
  const plan = DRFLOW_BILLING_PLANS.find((p) => p.id === planId);
  const label = plan?.name ?? planId;
  const clinic = clinicName?.trim() ? ` — consultorio: ${clinicName.trim()}` : "";
  return `Hola, quiero activar DrFlow plan ${label}${clinic}. ¿Me pasan link de pago?`;
}

export function getSalesContactEmail(): string {
  return process.env.NEXT_PUBLIC_SALES_EMAIL?.trim() || "ventas@opusorg.com";
}

export function getSalesWhatsAppPhone(): string | null {
  const raw = process.env.NEXT_PUBLIC_SALES_WHATSAPP?.trim();
  if (raw) return raw;
  // Número comercial DrFlow (AR). Override con NEXT_PUBLIC_SALES_WHATSAPP en Vercel.
  return "5491152591607";
}
