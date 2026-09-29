import { z } from "zod";

/**
 * Source of truth for customizable features. `supabase/migrations/20260928120000_feature_customizations.sql`
 * seeds `feature_definitions` with the same keys; keys unknown to this registry are always denied.
 *
 * Defaults MUST equal current app behavior. Customizations only restrict: they never grant
 * plan, product, Premium or RBAC access (see `gatedBy`).
 */

const EMPTY_CONFIG = z.object({}).strict();

const HEX_COLOR = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const HTTPS_URL = z
  .string()
  .max(500)
  .regex(/^https:\/\/[^\s"'<>]+$/);

export const FEATURE_CUSTOMIZATION_REGISTRY = {
  clinic_module: {
    label: "Módulo Clínica",
    category: "modules",
    defaultEnabled: true,
    configurableByClinic: true,
    configurableByUser: false,
    critical: true,
    gatedBy: "product.clinic",
    configSchema: EMPTY_CONFIG,
  },
  geriatrics_module: {
    label: "Módulo Geriatría",
    category: "modules",
    defaultEnabled: true,
    configurableByClinic: true,
    configurableByUser: false,
    critical: true,
    gatedBy: "product.geriatrics",
    configSchema: EMPTY_CONFIG,
  },
  home_hospitalization_module: {
    label: "Internación domiciliaria",
    category: "modules",
    defaultEnabled: false,
    configurableByClinic: true,
    configurableByUser: false,
    critical: true,
    gatedBy: null,
    configSchema: EMPTY_CONFIG,
  },
  waiting_room: {
    label: "Sala de espera",
    category: "operations",
    defaultEnabled: true,
    configurableByClinic: true,
    configurableByUser: true,
    critical: false,
    gatedBy: "rbac.manageWaitingRoom",
    configSchema: z
      .object({
        show_document_number: z.boolean().default(true),
        show_cancelled_section: z.boolean().default(true),
      })
      .strict(),
  },
  advanced_agenda: {
    label: "Agenda avanzada",
    category: "operations",
    defaultEnabled: true,
    configurableByClinic: true,
    configurableByUser: true,
    critical: false,
    gatedBy: null,
    configSchema: EMPTY_CONFIG,
  },
  unlimited_patients: {
    label: "Pacientes ilimitados",
    category: "billing",
    defaultEnabled: true,
    configurableByClinic: true,
    configurableByUser: false,
    critical: true,
    gatedBy: "plan.premium",
    configSchema: EMPTY_CONFIG,
  },
  advanced_reports: {
    label: "Reportes avanzados",
    category: "analytics",
    defaultEnabled: true,
    configurableByClinic: true,
    configurableByUser: true,
    critical: false,
    gatedBy: "entitlements",
    configSchema: EMPTY_CONFIG,
  },
  professional_management: {
    label: "Gestión de profesionales",
    category: "administration",
    defaultEnabled: true,
    configurableByClinic: true,
    configurableByUser: false,
    critical: true,
    gatedBy: "rbac",
    configSchema: EMPTY_CONFIG,
  },
  professional_settlements: {
    label: "Liquidaciones a profesionales",
    category: "administration",
    defaultEnabled: true,
    configurableByClinic: true,
    configurableByUser: false,
    critical: true,
    gatedBy: "rbac",
    configSchema: EMPTY_CONFIG,
  },
  custom_branding: {
    label: "Marca personalizada",
    category: "appearance",
    defaultEnabled: false,
    configurableByClinic: true,
    configurableByUser: false,
    critical: false,
    gatedBy: null,
    configSchema: z
      .object({
        primary_color: HEX_COLOR.optional(),
        logo_url: HTTPS_URL.optional(),
      })
      .strict(),
  },
  custom_fields: {
    label: "Campos personalizados",
    category: "data",
    defaultEnabled: false,
    configurableByClinic: true,
    configurableByUser: false,
    critical: false,
    gatedBy: null,
    configSchema: z
      .object({
        max_fields: z.number().int().min(0).max(50).default(10),
      })
      .strict(),
  },
  ai_assistant: {
    label: "Asistente IA",
    category: "ai",
    defaultEnabled: true,
    configurableByClinic: true,
    configurableByUser: true,
    critical: false,
    gatedBy: "entitlements",
    configSchema: EMPTY_CONFIG,
  },
  /** ON only allows the national flow to be evaluated; READY still requires REFEPS + repository + credentials. */
  national_electronic_prescription: {
    label: "Receta electrónica nacional",
    category: "compliance",
    defaultEnabled: false,
    configurableByClinic: true,
    configurableByUser: false,
    critical: true,
    gatedBy: "product.clinic + rbac.issuePrescriptions + national_readiness",
    configSchema: EMPTY_CONFIG,
  },
  /** External RCTA launch (link only). Restricts visibility; RBAC/plan still decide who may prescribe. */
  rcta_integration: {
    label: "Integración RCTA",
    category: "compliance",
    defaultEnabled: true,
    configurableByClinic: true,
    configurableByUser: true,
    critical: false,
    gatedBy: "product.clinic + rbac.viewClinicalRecords",
    configSchema: EMPTY_CONFIG,
  },
  rcta_prescriptions: {
    label: "RCTA — Recetas electrónicas",
    category: "compliance",
    defaultEnabled: true,
    configurableByClinic: true,
    configurableByUser: true,
    critical: false,
    gatedBy: "rcta_integration + rbac.issuePrescriptions",
    configSchema: EMPTY_CONFIG,
  },
  rcta_medical_orders: {
    label: "RCTA — Órdenes médicas",
    category: "compliance",
    defaultEnabled: true,
    configurableByClinic: true,
    configurableByUser: true,
    critical: false,
    gatedBy: "rcta_integration + rbac.issueMedicalOrders",
    configSchema: EMPTY_CONFIG,
  },
} as const satisfies Record<string, FeatureDefinition>;

export interface FeatureDefinition {
  label: string;
  category: string;
  defaultEnabled: boolean;
  configurableByClinic: boolean;
  configurableByUser: boolean;
  /** Critical changes require explicit confirmation in the Superadmin UI. */
  critical: boolean;
  /** Existing gate that still applies on top of the customization (never bypassed). */
  gatedBy: string | null;
  configSchema: z.ZodType<Record<string, unknown>>;
}

export type FeatureKey = keyof typeof FEATURE_CUSTOMIZATION_REGISTRY;

export const FEATURE_KEYS = Object.keys(FEATURE_CUSTOMIZATION_REGISTRY) as FeatureKey[];

export function isFeatureKey(value: unknown): value is FeatureKey {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(FEATURE_CUSTOMIZATION_REGISTRY, value)
  );
}

export function getFeatureDefinition(key: FeatureKey): FeatureDefinition {
  return FEATURE_CUSTOMIZATION_REGISTRY[key];
}

export function defaultFeatureConfig(key: FeatureKey): Record<string, unknown> {
  const parsed = getFeatureDefinition(key).configSchema.safeParse({});
  return parsed.success ? parsed.data : {};
}

export function featureConfigKeys(key: FeatureKey): string[] {
  const shape = (getFeatureDefinition(key).configSchema as { shape?: Record<string, unknown> }).shape;
  return shape ? Object.keys(shape) : [];
}

/** Dashboard routes gated by a customization (PoC: waiting_room only). */
export const CUSTOMIZATION_FEATURE_BY_HREF: Readonly<Record<string, FeatureKey>> = {
  "/sala-espera": "waiting_room",
};
