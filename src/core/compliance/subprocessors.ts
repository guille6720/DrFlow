/**
 * Phase 23 — Configurable subprocessor register (DrFlow Argentina).
 * Only providers discovered in the codebase are listed.
 * Unknown jurisdiction / DPA / privacy values stay REQUIERE VERIFICACIÓN.
 * Not legal advice.
 */

export const SUBPROCESSOR_REQUIERE_VERIFICACION = "REQUIERE VERIFICACIÓN" as const;

export type SubprocessorDpaStatus =
  | "signed"
  | "pending"
  | "not_applicable"
  | typeof SUBPROCESSOR_REQUIERE_VERIFICACION;

export type SubprocessorHealthData = "yes" | "no" | "unknown";

export type SubprocessorActivation = "always_on" | "optional_env" | "clinic_config" | "byok";

export type SubprocessorEntry = {
  id: string;
  name: string;
  purpose: string;
  dataCategories: string[];
  healthData: SubprocessorHealthData;
  /** Possible processing jurisdiction — unknown → REQUIERE VERIFICACIÓN */
  processingJurisdiction: string;
  dpaStatus: SubprocessorDpaStatus;
  internationalTransferReview: string;
  /** Privacy/security documentation status or URL */
  privacyDocStatus: string;
  activation: SubprocessorActivation;
  /** Code paths / env that prove the provider is in use or wired */
  codeEvidence: string[];
  configNotes?: string;
};

/**
 * Canonical register. Do not invent vendors (e.g. analytics) without code evidence.
 */
export const SUBPROCESSOR_REGISTER: SubprocessorEntry[] = [
  {
    id: "supabase",
    name: "Supabase Inc.",
    purpose:
      "Base de datos PostgreSQL, autenticación, almacenamiento de archivos clínicos (bucket privado).",
    dataCategories: [
      "Datos de cuenta y membresía",
      "Datos demográficos de pacientes",
      "Historias clínicas",
      "Recetas",
      "Adjuntos clínicos",
      "Logs de auditoría",
    ],
    healthData: "yes",
    processingJurisdiction: `${SUBPROCESSOR_REQUIERE_VERIFICACION} (región del proyecto Supabase)`,
    dpaStatus: SUBPROCESSOR_REQUIERE_VERIFICACION,
    internationalTransferReview:
      "Evaluar transferencia internacional según ubicación del proyecto y contrato DPA con Supabase.",
    privacyDocStatus: "https://supabase.com/privacy",
    activation: "always_on",
    codeEvidence: [
      "src/core/supabase/admin.ts",
      "src/core/supabase/env.ts",
      "SUPABASE_SERVICE_ROLE_KEY",
      "NEXT_PUBLIC_SUPABASE_URL",
    ],
    configNotes: "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (server-only)",
  },
  {
    id: "vercel",
    name: "Vercel Inc.",
    purpose: "Hosting de la aplicación Next.js, edge/middleware, despliegue de API routes.",
    dataCategories: [
      "Metadatos de solicitudes HTTP",
      "Cookies de sesión (tránsito)",
      "Logs de aplicación",
    ],
    healthData: "unknown",
    processingJurisdiction: `${SUBPROCESSOR_REQUIERE_VERIFICACION} (región de despliegue Vercel)`,
    dpaStatus: SUBPROCESSOR_REQUIERE_VERIFICACION,
    internationalTransferReview: "Evaluar DPA Vercel y región de compute.",
    privacyDocStatus: "https://vercel.com/legal/privacy-policy",
    activation: "always_on",
    codeEvidence: ["src/core/supabase/env.ts", "VERCEL_URL", "VERCEL_ENV", "package.json (Next.js)"],
  },
  {
    id: "google_vertex",
    name: "Google Cloud / Vertex AI (Gemini)",
    purpose:
      "Procesamiento de consultas del asistente clínico Gemini cuando Vertex AI o Gemini API están configurados.",
    dataCategories: [
      "Texto clínico anonimizado",
      "Consultas del médico (sanitizadas)",
      "Estadísticas agregadas del consultorio (pacientes tokenizados)",
    ],
    healthData: "yes",
    processingJurisdiction: `${SUBPROCESSOR_REQUIERE_VERIFICACION} (VERTEX_AI_LOCATION, cuenta GCP)`,
    dpaStatus: SUBPROCESSOR_REQUIERE_VERIFICACION,
    internationalTransferReview:
      "Obligatorio antes de uso comercial con datos de salud. Configurar región y DPA Google Cloud.",
    privacyDocStatus: "https://cloud.google.com/terms/cloud-privacy-notice",
    activation: "optional_env",
    codeEvidence: [
      "src/lib/utils/clinical-ai-llm-provider.server.ts",
      "VERTEX_AI_PROJECT",
      "GEMINI_API_KEY",
    ],
    configNotes: "VERTEX_AI_PROJECT, VERTEX_AI_SERVICE_ACCOUNT_JSON, GEMINI_API_KEY",
  },
  {
    id: "mercadopago",
    name: "Mercado Pago (MercadoLibre S.R.L.)",
    purpose: "Cobro de suscripciones SaaS vía Checkout Pro y notificaciones de pago.",
    dataCategories: [
      "Datos de facturación del consultorio",
      "Identificadores de pago",
      "Estado de transacciones",
    ],
    healthData: "no",
    processingJurisdiction: "Argentina",
    dpaStatus: SUBPROCESSOR_REQUIERE_VERIFICACION,
    internationalTransferReview: "Evaluar términos Mercado Pago para datos de pagadores.",
    privacyDocStatus: "https://www.mercadopago.com.ar/privacidad",
    activation: "optional_env",
    codeEvidence: [
      "src/core/billing/mercadopago.ts",
      "src/app/api/billing/webhooks/mercadopago/route.ts",
      "MP_ACCESS_TOKEN",
      "MP_WEBHOOK_SECRET",
    ],
    configNotes: "MP_ACCESS_TOKEN / MERCADOPAGO_ACCESS_TOKEN, MP_WEBHOOK_SECRET",
  },
  {
    id: "email_smtp",
    name: "Proveedor de email (SMTP / Resend)",
    purpose: "Emails transaccionales: invitaciones de equipo, recordatorios, notificaciones.",
    dataCategories: [
      "Direcciones de email",
      "Nombres",
      "Contenido de notificaciones (puede incluir datos de turnos)",
    ],
    healthData: "unknown",
    processingJurisdiction: `${SUBPROCESSOR_REQUIERE_VERIFICACION} (según SMTP_HOST o Resend)`,
    dpaStatus: SUBPROCESSOR_REQUIERE_VERIFICACION,
    internationalTransferReview: "Verificar proveedor efectivo (Hostinger, Resend, etc.).",
    privacyDocStatus: SUBPROCESSOR_REQUIERE_VERIFICACION,
    activation: "optional_env",
    codeEvidence: ["src/lib/services/transactional-email.ts", "SMTP_HOST", "RESEND_API_KEY"],
    configNotes: "SMTP_* o RESEND_API_KEY, EMAIL_FROM",
  },
  {
    id: "sentry",
    name: "Sentry (Functional Software Inc.)",
    purpose: "Monitoreo de errores en producción (opcional).",
    dataCategories: [
      "Stack traces",
      "Metadatos de sesión",
      "Posible contexto de error (debe excluir PHI)",
    ],
    healthData: "unknown",
    processingJurisdiction: SUBPROCESSOR_REQUIERE_VERIFICACION,
    dpaStatus: SUBPROCESSOR_REQUIERE_VERIFICACION,
    internationalTransferReview: "Configurar scrubbing de PHI antes de activar en producción.",
    privacyDocStatus: "https://sentry.io/privacy/",
    activation: "optional_env",
    codeEvidence: [
      "src/core/observability/sentry.server.ts",
      "@sentry/node",
      "@sentry/browser",
      "SENTRY_DSN",
    ],
    configNotes: "SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN",
  },
  {
    id: "daily_co",
    name: "Daily.co (opcional)",
    purpose: "Telemedicina con salas de video (si DAILY_API_KEY está configurado).",
    dataCategories: ["Metadatos de sesión de video", "Posible audio/video en tránsito"],
    healthData: "unknown",
    processingJurisdiction: SUBPROCESSOR_REQUIERE_VERIFICACION,
    dpaStatus: SUBPROCESSOR_REQUIERE_VERIFICACION,
    internationalTransferReview: "Evaluar antes de uso comercial con pacientes.",
    privacyDocStatus: "https://www.daily.co/privacy",
    activation: "optional_env",
    codeEvidence: ["src/core/telemedicine/provider.ts", "DAILY_API_KEY", "DAILY_DOMAIN"],
    configNotes: "DAILY_API_KEY, DAILY_DOMAIN",
  },
  {
    id: "jitsi",
    name: "Jitsi (meet.jit.si — 8x8)",
    purpose: "Videoconsultas por defecto (embed sin API key).",
    dataCategories: [
      "Audio y video de consulta",
      "Nombre para mostrar en sala",
      "Identificador de sala",
    ],
    healthData: "yes",
    processingJurisdiction: SUBPROCESSOR_REQUIERE_VERIFICACION,
    dpaStatus: SUBPROCESSOR_REQUIERE_VERIFICACION,
    internationalTransferReview:
      "Servicio público meet.jit.si — evaluar antes de uso comercial con pacientes.",
    privacyDocStatus: "https://jitsi.org/security/",
    activation: "always_on",
    codeEvidence: ["src/core/telemedicine/provider.ts", "https://meet.jit.si"],
    configNotes: "Default en telemedicine/provider.ts — sin variables de entorno",
  },
  {
    id: "meta_whatsapp",
    name: "Meta Platforms — WhatsApp Cloud API",
    purpose: "Recordatorios de turnos, notificaciones y links de telemedicina vía WhatsApp.",
    dataCategories: [
      "Número de teléfono",
      "Nombre del paciente",
      "Fecha y hora de turno",
      "Nombre del profesional y consultorio",
    ],
    healthData: "unknown",
    processingJurisdiction: SUBPROCESSOR_REQUIERE_VERIFICACION,
    dpaStatus: SUBPROCESSOR_REQUIERE_VERIFICACION,
    internationalTransferReview: "Evaluar términos Meta Business / WhatsApp Business API.",
    privacyDocStatus: "https://www.whatsapp.com/legal/privacy-policy-eea",
    activation: "optional_env",
    codeEvidence: [
      "src/core/whatsapp/provider.ts",
      "WHATSAPP_ACCESS_TOKEN",
      "WHATSAPP_PHONE_NUMBER_ID",
    ],
    configNotes: "WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_API_VERSION",
  },
  {
    id: "byok_ai",
    name: "Proveedor IA BYOK del usuario/clínica",
    purpose:
      "Cuando la clínica configura su propia API key (OpenAI, Anthropic, Gemini, compatible).",
    dataCategories: ["Texto clínico sanitizado", "Contexto de consulta"],
    healthData: "yes",
    processingJurisdiction: `${SUBPROCESSOR_REQUIERE_VERIFICACION} (según proveedor elegido por la clínica)`,
    dpaStatus: "not_applicable",
    internationalTransferReview:
      "Responsabilidad compartida: la clínica elige el proveedor; DrFlow sanitiza antes del envío.",
    privacyDocStatus: SUBPROCESSOR_REQUIERE_VERIFICACION,
    activation: "byok",
    codeEvidence: [
      "src/lib/utils/clinical-ai-llm-provider.server.ts",
      "CLINICAL_AI_LLM_API_KEY",
      "OPENAI_API_KEY",
    ],
  },
  {
    id: "refeps",
    name: "REFEPS / RENaPDiS (API configurable)",
    purpose:
      "Registro y trazabilidad de recetas electrónicas cuando la clínica tiene homologación.",
    dataCategories: [
      "DNI y nombre del paciente",
      "Obra social y número de afiliado",
      "Diagnóstico CIE-10 y medicación",
      "Datos del profesional y establecimiento",
    ],
    healthData: "yes",
    processingJurisdiction: "Argentina (si API oficial MSN)",
    dpaStatus: SUBPROCESSOR_REQUIERE_VERIFICACION,
    internationalTransferReview: "No aplica si API oficial en Argentina.",
    privacyDocStatus: SUBPROCESSOR_REQUIERE_VERIFICACION,
    activation: "clinic_config",
    codeEvidence: [
      "src/core/refeps/provider.ts",
      "src/lib/actions/refeps.ts",
      "REFEPS_API_URL",
      "REFEPS_API_KEY",
    ],
    configNotes: "REFEPS_API_URL, REFEPS_API_KEY; clinic.refeps_enabled",
  },
];

/** Explicitly NOT listed — no product analytics SDK discovered in the repo. */
export const SUBPROCESSORS_NOT_DISCOVERED = [
  {
    id: "product_analytics",
    label: "Analytics de producto (PostHog, GA, Mixpanel, etc.)",
    reason: "No hay integración de analytics de producto en el código revisado.",
  },
] as const;

export const SUBPROCESSOR_REQUIRED_FIELDS = [
  "purpose",
  "dataCategories",
  "healthData",
  "processingJurisdiction",
  "dpaStatus",
  "internationalTransferReview",
  "privacyDocStatus",
] as const;

export function getSubprocessorById(id: string): SubprocessorEntry | undefined {
  return SUBPROCESSOR_REGISTER.find((entry) => entry.id === id);
}

export function listSubprocessors(): SubprocessorEntry[] {
  return [...SUBPROCESSOR_REGISTER];
}

export function assertSubprocessorEntryComplete(entry: SubprocessorEntry): boolean {
  if (!entry.purpose.trim()) return false;
  if (!entry.dataCategories.length) return false;
  if (!entry.healthData) return false;
  if (!entry.processingJurisdiction.trim()) return false;
  if (!entry.dpaStatus) return false;
  if (!entry.internationalTransferReview.trim()) return false;
  if (!entry.privacyDocStatus.trim()) return false;
  if (!entry.codeEvidence.length) return false;
  return true;
}

export function countEntriesNeedingVerification(): number {
  return SUBPROCESSOR_REGISTER.filter(
    (e) =>
      e.dpaStatus === SUBPROCESSOR_REQUIERE_VERIFICACION ||
      e.privacyDocStatus.includes(SUBPROCESSOR_REQUIERE_VERIFICACION) ||
      e.processingJurisdiction.includes(SUBPROCESSOR_REQUIERE_VERIFICACION)
  ).length;
}

export type SubprocessorRegisterPosture = {
  entryCount: number;
  allEntriesComplete: boolean;
  unknownMustStayRequiereVerificacion: true;
  analyticsNotInvented: true;
  verificationPendingCount: number;
  notes: string[];
};

export function evaluateSubprocessorRegisterPosture(): SubprocessorRegisterPosture {
  const allEntriesComplete = SUBPROCESSOR_REGISTER.every(assertSubprocessorEntryComplete);
  return {
    entryCount: SUBPROCESSOR_REGISTER.length,
    allEntriesComplete,
    unknownMustStayRequiereVerificacion: true,
    analyticsNotInvented: true,
    verificationPendingCount: countEntriesNeedingVerification(),
    notes: [
      "Fuente canónica: src/core/compliance/subprocessors.ts",
      "Borrador legal: docs/legal/SUBPROCESSORS-DRAFT.md",
      "No inventar proveedores sin evidencia en código (p. ej. analytics).",
    ],
  };
}
