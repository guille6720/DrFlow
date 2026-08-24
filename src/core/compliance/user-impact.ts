/**
 * Phase 28 — User impact assessment for Argentina compliance / monetization branch.
 * Levels: LOW | MEDIUM | HIGH per category.
 * Before declaring completion — existing users may be affected.
 * Not legal advice.
 */

export type UserImpactLevel = "LOW" | "MEDIUM" | "HIGH";

export type UserImpactCategoryId =
  | "database"
  | "authentication"
  | "clinic"
  | "patient_data"
  | "subscription"
  | "ui"
  | "api";

export type UserImpactCategory = {
  id: UserImpactCategoryId;
  label: string;
  level: UserImpactLevel;
  summary: string;
  userVisibleEffects: string[];
  mitigations: string[];
  relatedPhases: string[];
};

/**
 * Impact of compliance/monetization work (approx. phases 7–27) on existing tenants.
 */
export const USER_IMPACT_CATEGORIES: UserImpactCategory[] = [
  {
    id: "database",
    label: "Database impact",
    level: "MEDIUM",
    summary:
      "Migraciones 132–137 aditivas/endurecen funciones y RLS; no borran clínicas ni HC. Cambios de comportamiento en gates y storage.",
    userVisibleEffects: [
      "Nuevas columnas de consentimiento (retiro) y tabla de pedidos ARCO.",
      "RPCs api_* exigen membresía de clínica (antes podían invocarse cross-tenant).",
      "Bucket clinical-files forzado privado; paths de export/firmas clasificados.",
      "clinic_subscription_active trata canceled con período futuro como acceso vigente.",
    ],
    mitigations: [
      "IF NOT EXISTS / CREATE OR REPLACE; verify staging pasó sin wipe de clinics/profiles.",
      "Rollbacks documentados en supabase/migrations/rollback/.",
    ],
    relatedPhases: ["9", "10", "11", "12", "14", "21", "27"],
  },
  {
    id: "authentication",
    label: "Authentication impact",
    level: "LOW",
    summary:
      "Sin cambio de proveedor Auth/Supabase. Rate-limit y CSRF en login/reset endurecen abuso, no el login legítimo habitual.",
    userVisibleEffects: [
      "Posible 429 tras muchos intentos de login/reset fallidos.",
      "Mutaciones JSON de API siguen exigiendo same-origin (ya esperado).",
    ],
    mitigations: [
      "Límites pensados para abuso, no para uso clínico normal.",
      "Webhook MP autenticado por HMAC (no CSRF de browser).",
    ],
    relatedPhases: ["15", "19"],
  },
  {
    id: "clinic",
    label: "Clinic impact",
    level: "MEDIUM",
    summary:
      "Consultorios ganan paneles de privacidad/consentimiento y cancelación de plan; gate de API pública más estricto para integradores.",
    userVisibleEffects: [
      "Configuración: cancelar suscripción self-serve + avisos legales B2B/B2C.",
      "Cola administrativa de derechos ARCO (staff).",
      "Integradores API: llamadas con clinic_id ajeno fallan FORBIDDEN.",
      "Protocolos de investigación clínica ocultos/bloqueados salvo flag ON.",
    ],
    mitigations: [
      "Cancelación conserva acceso hasta fin de período pagado.",
      "Flag clinical_research_protocols default OFF (sin sorpresa de reclutamiento).",
    ],
    relatedPhases: ["10", "11", "12", "18", "21"],
  },
  {
    id: "patient_data",
    label: "Patient data impact",
    level: "MEDIUM",
    summary:
      "No se destruye HC por pedidos de privacidad; exportaciones y storage más estrictos; IA sanitiza/bloquea envíos inseguros.",
    userVisibleEffects: [
      "Exports con TTL corto / sin URL pública permanente.",
      "Adjuntos/firmas vía URLs firmadas path-aware.",
      "Soft-delete paciente no implica hard-delete de HC (retención).",
      "Asistente IA puede rechazar (422) si sanitización falla.",
      "Recetas etiquetadas como locales/borrador (no homologación fingida).",
    ],
    mitigations: [
      "Pedidos deletion/blocking requieren ack de retención clínica.",
      "Fail-safe IA evita filtrar PHI identificable al proveedor.",
    ],
    relatedPhases: ["7", "8", "13", "14", "17", "4", "3"],
  },
  {
    id: "subscription",
    label: "Subscription impact",
    level: "HIGH",
    summary:
      "Flujo comercial de suscripción cambia: monto vs catálogo, cancelación self-serve, past_due en refund/chargeback, metadata fiscal diferida.",
    userVisibleEffects: [
      "Pagos aprobados con monto distinto al catálogo no activan plan.",
      "Admin puede cancelar desde Configuración (acceso hasta vencimiento).",
      "Refund/chargeback MP puede marcar past_due.",
      "Comprobante MP sigue sin ser factura ARCA (aviso fiscal).",
    ],
    mitigations: [
      "Idempotencia por payment_id; HMAC webhook; clinicId de sesión en checkout.",
      "Accesos manuales no se cancelan self-serve (derivar a ventas).",
    ],
    relatedPhases: ["19", "20", "21"],
  },
  {
    id: "ui",
    label: "UI impact",
    level: "MEDIUM",
    summary:
      "Cambios visibles en plan, privacidad, recetas e IA; sin rediseño global del dashboard clínico.",
    userVisibleEffects: [
      "Botón Cancelar suscripción + estados canceled/paid-through.",
      "Paneles compliance / privacy rights en configuración.",
      "Textos RECETA LOCAL / BORRADOR; labels REFEPS adapter honestos.",
      "Ocultamiento de Protocolos de investigación si flag OFF.",
    ],
    mitigations: [
      "Cancelación: una sola confirmación, sin dark patterns.",
      "Copy legal marcado como borrador / REQUIERE REVISIÓN donde aplica.",
    ],
    relatedPhases: ["17", "18", "21", "12"],
  },
  {
    id: "api",
    label: "API impact",
    level: "MEDIUM",
    summary:
      "APIs públicas y de billing más estrictas; webhooks y exports con controles de seguridad.",
    userVisibleEffects: [
      "Public API RPCs: gate multi-tenant (FORBIDDEN cross-clinic).",
      "Billing webhook: firma HMAC; secret obligatorio en prod.",
      "create-preference: CSRF + ACL settings.",
      "Headers de seguridad / rate-limit / SSRF guards en rutas sensibles.",
    ],
    mitigations: [
      "Clientes API legítimos del propio clinic_id no deberían notar regresión.",
      "Integradores mal configurados fallan cerrado (esperado).",
    ],
    relatedPhases: ["10", "13", "15", "19"],
  },
];

export type UserImpactPosture = {
  categoryCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  overallLevel: UserImpactLevel;
  completionBlockedWithoutReview: false;
  notes: string[];
};

export function getUserImpactById(
  id: UserImpactCategoryId
): UserImpactCategory | undefined {
  return USER_IMPACT_CATEGORIES.find((c) => c.id === id);
}

export function evaluateUserImpactPosture(): UserImpactPosture {
  const highCount = USER_IMPACT_CATEGORIES.filter((c) => c.level === "HIGH").length;
  const mediumCount = USER_IMPACT_CATEGORIES.filter((c) => c.level === "MEDIUM").length;
  const lowCount = USER_IMPACT_CATEGORIES.filter((c) => c.level === "LOW").length;
  const overallLevel: UserImpactLevel =
    highCount > 0 ? "HIGH" : mediumCount > 0 ? "MEDIUM" : "LOW";

  return {
    categoryCount: USER_IMPACT_CATEGORIES.length,
    highCount,
    mediumCount,
    lowCount,
    overallLevel,
    completionBlockedWithoutReview: false,
    notes: [
      "Mayor impacto: suscripciones (cancelación, validación de monto, past_due).",
      "Datos de paciente: endurecimiento sin destrucción automática de HC.",
      "Auth: impacto bajo.",
      "Comunicar a clínicas con plan pago el nuevo botón de cancelación y reglas de monto.",
    ],
  };
}

/** Required categories for Phase 28 report. */
export const USER_IMPACT_REQUIRED_CATEGORY_IDS: UserImpactCategoryId[] = [
  "database",
  "authentication",
  "clinic",
  "patient_data",
  "subscription",
  "ui",
  "api",
];
