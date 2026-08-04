import type { PluginId } from "@/plugins/registry";

/** Granular feature flags — toggled per clinic without redeploy (Phase 14). */
export type FeatureFlagId =
  | "command_palette"
  | "floating_actions"
  | "clinical_timeline"
  | "clinical_operations"
  | "recordatorios"
  | "consultation_assistant"
  | "admin_ops_assistant"
  | "patient_audit_tab"
  | "public_booking_online";

export type FeatureFlagCategory = "ux" | "clinical" | "agenda" | "compliance";

export type FeatureFlagDefinition = {
  id: FeatureFlagId;
  label: string;
  description: string;
  category: FeatureFlagCategory;
  defaultEnabled: boolean;
  requiresPlugin?: PluginId;
};

export const FEATURE_FLAG_REGISTRY: FeatureFlagDefinition[] = [
  {
    id: "command_palette",
    label: "Command Palette (Ctrl+K)",
    description: "Búsqueda global y accesos rápidos desde cualquier pantalla.",
    category: "ux",
    defaultEnabled: true,
  },
  {
    id: "floating_actions",
    label: "Botón flotante +",
    description: "Acciones rápidas (turno, paciente, consulta) en esquina inferior.",
    category: "ux",
    defaultEnabled: true,
  },
  {
    id: "clinical_timeline",
    label: "Timeline clínico",
    description: "Pestaña cronológica unificada en el workspace del paciente.",
    category: "clinical",
    defaultEnabled: true,
  },
  {
    id: "clinical_operations",
    label: "Centro de operaciones",
    description: "Panel operativo en dashboard (cola, alertas, urgencias).",
    category: "clinical",
    defaultEnabled: true,
  },
  {
    id: "recordatorios",
    label: "Recordatorios",
    description: "Sección de recordatorios automáticos en el menú.",
    category: "agenda",
    defaultEnabled: true,
  },
  {
    id: "consultation_assistant",
    label: "Asistente en consulta",
    description: "Panel de sugerencias inline al escribir evoluciones.",
    category: "clinical",
    defaultEnabled: true,
    requiresPlugin: "ia",
  },
  {
    id: "admin_ops_assistant",
    label: "Asistente operativo",
    description: "Copilot de secretaría y operaciones (cola, caja, tareas del día).",
    category: "ux",
    defaultEnabled: true,
    requiresPlugin: "ia",
  },
  {
    id: "patient_audit_tab",
    label: "Pestaña auditoría",
    description: "Timeline de auditoría inmutable en ficha del paciente.",
    category: "compliance",
    defaultEnabled: true,
  },
  {
    id: "public_booking_online",
    label: "Turnos online públicos",
    description: "Link de reserva pública para pacientes (portal).",
    category: "agenda",
    defaultEnabled: true,
    requiresPlugin: "portal",
  },
];

const FLAG_MAP = new Map(FEATURE_FLAG_REGISTRY.map((f) => [f.id, f]));

export function getFeatureFlagDefinition(id: FeatureFlagId): FeatureFlagDefinition {
  const def = FLAG_MAP.get(id);
  if (!def) throw new Error(`Unknown feature flag: ${id}`);
  return def;
}

export function listFeatureFlags(): FeatureFlagDefinition[] {
  return FEATURE_FLAG_REGISTRY;
}

export const NAV_FLAG_BY_HREF: Partial<Record<string, FeatureFlagId>> = {
  "/recordatorios": "recordatorios",
};
