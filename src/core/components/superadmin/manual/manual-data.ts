import type { ManualIllustrationId } from "@/core/components/superadmin/manual/manual-illustration-markup";

/** Metadata del Manual de Superadmin (mantenible). */
export const SUPERADMIN_MANUAL_META = {
  title: "Manual de Superadmin",
  version: "1.0",
  /** Fecha de revisión del contenido del manual (no inventar build dates dinámicos engañosos). */
  contentUpdatedAt: "2026-08-20",
  route: "/superadmin/manual",
} as const;

export type ManualSectionId =
  | "intro"
  | "quick-start"
  | "dashboard"
  | "clinics"
  | "clinic-detail"
  | "change-plan"
  | "downgrade"
  | "overrides"
  | "temporary"
  | "plans"
  | "features"
  | "usage"
  | "recommendations"
  | "recommendation-examples"
  | "trial"
  | "legacy"
  | "common-tasks"
  | "safety"
  | "glossary";

export type ManualImageRef = {
  illustrationId: ManualIllustrationId;
  alt: string;
  caption?: string;
};

export type ManualSection = {
  id: ManualSectionId;
  title: string;
  keywords: string[];
  summary: string;
  image?: ManualImageRef;
};

export const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: "intro",
    title: "Qué es Superadmin",
    keywords: ["superadmin", "introducción", "comercial", "control"],
    summary: "Centro comercial y administrativo de NexClinic.",
  },
  {
    id: "quick-start",
    title: "Inicio rápido",
    keywords: ["inicio", "pasos", "flujo", "quick"],
    summary: "Flujo habitual para revisar y ajustar una clínica.",
    image: {
      illustrationId: "quick-start",
      alt: "Ilustración del flujo rápido: clínicas → detalle → plan o override → auditoría",
      caption: "Ilustración (datos demo). Flujo operativo típico.",
    },
  },
  {
    id: "dashboard",
    title: "Dashboard",
    keywords: ["dashboard", "métricas", "trial", "límites", "recomendaciones"],
    summary: "Vista operativa de clínicas, planes y alertas comerciales.",
    image: {
      illustrationId: "dashboard-overview",
      alt: "Ilustración del dashboard Superadmin con métricas demo",
      caption: "Ilustración del dashboard (clínicas y métricas ficticias).",
    },
  },
  {
    id: "clinics",
    title: "Clínicas",
    keywords: ["clínicas", "buscar", "filtro", "plan", "estado", "legacy", "trial"],
    summary: "Listado, búsqueda y filtros comerciales.",
    image: {
      illustrationId: "clinics-list",
      alt: "Ilustración del listado de clínicas con badges de plan",
      caption: "Ilustración del listado (nombres demo).",
    },
  },
  {
    id: "clinic-detail",
    title: "Detalle comercial",
    keywords: ["detalle", "entitlements", "uso", "historial", "override"],
    summary: "Ficha comercial de una clínica.",
    image: {
      illustrationId: "clinic-detail",
      alt: "Ilustración del detalle comercial de una clínica demo",
      caption: "Ilustración del detalle (sin datos clínicos).",
    },
  },
  {
    id: "change-plan",
    title: "Cambiar plan",
    keywords: ["cambiar", "plan", "diff", "features", "límites", "confirmar"],
    summary: "Cambio manual de plan con comparación de features.",
    image: {
      illustrationId: "change-plan",
      alt: "Ilustración del diálogo de confirmación de cambio de plan",
      caption: "Ilustración de la confirmación con diff de features.",
    },
  },
  {
    id: "downgrade",
    title: "Advertencia de downgrade",
    keywords: ["downgrade", "bajar", "precaución", "datos clínicos"],
    summary: "Qué implica bajar de plan y qué no se borra.",
  },
  {
    id: "overrides",
    title: "Overrides de features",
    keywords: ["override", "excepción", "pami", "ai", "whatsapp", "precedencia"],
    summary: "Excepciones por clínica sobre el plan.",
    image: {
      illustrationId: "feature-override",
      alt: "Ilustración del formulario de override de feature",
      caption: "Ilustración de alta de override (motivo y vigencia).",
    },
  },
  {
    id: "temporary",
    title: "Acceso temporal",
    keywords: ["temporal", "vence", "30 días", "ai.enabled"],
    summary: "Otorgar acceso con fecha de fin.",
  },
  {
    id: "plans",
    title: "Planes",
    keywords: ["planes", "trial", "basic", "pro", "premium", "enterprise", "legacy"],
    summary: "Catálogo comercial y edición de metadatos.",
    image: {
      illustrationId: "plans",
      alt: "Ilustración del catálogo de planes",
      caption: "Ilustración del catálogo (Legacy marcado como interno).",
    },
  },
  {
    id: "features",
    title: "Features",
    keywords: ["features", "boolean", "limit", "metered", "key", "desactivar"],
    summary: "Catálogo de funcionalidades comerciales.",
    image: {
      illustrationId: "features",
      alt: "Ilustración del catálogo de features",
      caption: "Ilustración del catálogo de features (claves técnicas en inglés).",
    },
  },
  {
    id: "usage",
    title: "Consumo",
    keywords: ["consumo", "uso", "límite", "70", "85", "100", "porcentaje"],
    summary: "Monitoreo de uso medido y umbrales.",
    image: {
      illustrationId: "usage",
      alt: "Ilustración de la pantalla de consumo",
      caption: "Ilustración de consumo con bandas Normal / Warning / Critical.",
    },
  },
  {
    id: "recommendations",
    title: "Recomendaciones",
    keywords: ["recomendaciones", "upgrade", "dismiss", "accepted", "reviewed"],
    summary: "Sugerencias de plan sin cambio automático.",
    image: {
      illustrationId: "recommendations",
      alt: "Ilustración de alertas de upgrade recomendado",
      caption: "Ilustración de recomendaciones (decisión siempre manual).",
    },
  },
  {
    id: "recommendation-examples",
    title: "Ejemplos de recomendación",
    keywords: ["ejemplos", "basic", "pro", "premium", "pami", "ai", "override"],
    summary: "Casos típicos del motor de recomendación.",
  },
  {
    id: "trial",
    title: "Clínicas Trial",
    keywords: ["trial", "trialing", "alta", "conversión"],
    summary: "Onboarding comercial y conversión manual.",
  },
  {
    id: "legacy",
    title: "Clínicas Legacy",
    keywords: ["legacy", "migración", "interno", "revisión"],
    summary: "Plan interno de migración: revisión manual.",
  },
  {
    id: "common-tasks",
    title: "Tareas frecuentes",
    keywords: ["tareas", "atajos", "cómo"],
    summary: "Accesos rápidos a procedimientos habituales.",
  },
  {
    id: "safety",
    title: "Reglas de seguridad",
    keywords: ["seguridad", "auditoría", "producción", "datos clínicos"],
    summary: "Qué nunca hacer y qué siempre revisar.",
  },
  {
    id: "glossary",
    title: "Glosario",
    keywords: ["glosario", "definición", "plan", "feature", "entitlement"],
    summary: "Definiciones breves en español.",
  },
];

export const MANUAL_COMMON_TASKS: { title: string; href: string; blurb: string }[] = [
  { title: "Cambiar el plan de una clínica", href: "#change-plan", blurb: "Diff de features y confirmación." },
  { title: "Dar AI temporal", href: "#temporary", blurb: "Override con fecha de fin." },
  { title: "Subir una cuota mensual", href: "#overrides", blurb: "Override de límite medido." },
  { title: "Desactivar una feature", href: "#overrides", blurb: "Override enabled = false." },
  { title: "Revisar una recomendación", href: "#recommendations", blurb: "Severidad, motivos y estado." },
  { title: "Descartar una recomendación", href: "#recommendations", blurb: "Dismiss sin cambiar el plan." },
  { title: "Revisar consumo", href: "#usage", blurb: "Porcentajes y umbrales." },
  { title: "Revisar un Trial", href: "#trial", blurb: "Estado trialing y plan sugerido." },
  { title: "Migrar un Legacy", href: "#legacy", blurb: "Revisión comercial manual." },
];

export const MANUAL_GLOSSARY: { term: string; definition: string }[] = [
  { term: "Plan", definition: "Paquete comercial (Trial, Basic, Pro, etc.) que define features y límites." },
  { term: "Feature", definition: "Funcionalidad comercial identificada por una key (ej. ai.enabled)." },
  {
    term: "Entitlement",
    definition: "Derecho efectivo de una clínica a usar una feature (resultado de plan + overrides).",
  },
  { term: "Override", definition: "Excepción por clínica que puede habilitar, deshabilitar o cambiar un límite." },
  { term: "Límite", definition: "Tope numérico (pacientes, requests de AI, etc.). Null suele significar ilimitado." },
  { term: "Uso / Consumo", definition: "Cantidad consumida en el período para features medidas." },
  { term: "Feature medida (metered)", definition: "Feature cuyo uso se contabiliza (ej. ai.monthly_requests)." },
  { term: "Trial", definition: "Plan de alta para clínicas nuevas; estado típico trialing." },
  { term: "Legacy", definition: "Plan interno de migración; no es un plan comercial público." },
  { term: "Recomendación", definition: "Sugerencia de upgrade. Nunca cambia el plan sola." },
  { term: "Suscripción", definition: "Registro comercial vigente de la clínica (plan + estado)." },
  { term: "Superadmin", definition: "Perfil con privilegio global de administración comercial." },
];
