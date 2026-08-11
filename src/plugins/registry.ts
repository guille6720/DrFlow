/** Optional plugin identifiers — core platform modules are always on. */
import { pamiNavMessages } from "@/locales/es-AR/pami/nav";

export type PluginId =
  | "pami"
  | "ia"
  | "telemedicina"
  | "facturacion"
  | "pharmacology"
  | "portal"
  | "voice"
  | "laboratorio"
  | "imagenes"
  | "odontologia"
  | "veterinaria";

export type PluginTier = "core" | "optional" | "lab" | "planned";

export type PluginDefinition = {
  id: PluginId;
  label: string;
  description: string;
  tier: PluginTier;
  defaultEnabled: boolean;
  routes: string[];
  featureModuleId?: string;
};

export const PLUGIN_REGISTRY: PluginDefinition[] = [
  {
    id: "pami",
    label: pamiNavMessages.plugin.label,
    description: pamiNavMessages.plugin.description,
    tier: "optional",
    defaultEnabled: true,
    routes: ["/guia-pami", "/pami/planillas"],
    featureModuleId: "pami",
  },
  {
    id: "ia",
    label: "IA clínica",
    description: "Asistente integrado en paciente y consultas.",
    tier: "optional",
    defaultEnabled: true,
    routes: [],
    featureModuleId: "ia",
  },
  {
    id: "pharmacology",
    label: "Guía farmacológica",
    description: "CIE-10, síntomas y referencias de tratamiento.",
    tier: "optional",
    defaultEnabled: true,
    routes: ["/herramientas/farmacologia"],
    featureModuleId: "pharmacology",
  },
  {
    id: "portal",
    label: "Portal paciente",
    description: "PWA paciente y reserva pública de turnos.",
    tier: "optional",
    defaultEnabled: true,
    routes: ["/portal", "/solicitar-turno"],
    featureModuleId: "portal",
  },
  {
    id: "voice",
    label: "Dictado por voz",
    description: "Micrófono en campos clínicos (Web Speech API).",
    tier: "optional",
    defaultEnabled: true,
    routes: [],
    featureModuleId: "voice",
  },
  {
    id: "telemedicina",
    label: "Telemedicina",
    description: "Videoconsulta integrada (Jitsi embed, Daily.co opcional).",
    tier: "optional",
    defaultEnabled: true,
    routes: ["/telemedicina"],
    featureModuleId: "telemedicina",
  },
  {
    id: "facturacion",
    label: "Facturación / pagos",
    description: "Cobros en línea (mock Mercado Pago — laboratorio).",
    tier: "lab",
    defaultEnabled: false,
    routes: ["/pagos"],
    featureModuleId: "facturacion",
  },
  {
    id: "laboratorio",
    label: "Laboratorio (LIS)",
    description: "Integración con laboratorio — plugin planificado.",
    tier: "planned",
    defaultEnabled: false,
    routes: [],
    featureModuleId: "laboratorio",
  },
  {
    id: "imagenes",
    label: "Imágenes (PACS)",
    description: "Integración radiología — plugin planificado.",
    tier: "planned",
    defaultEnabled: false,
    routes: [],
    featureModuleId: "imagenes",
  },
  {
    id: "odontologia",
    label: "Odontología",
    description: "Odontograma y tratamientos — plugin planificado.",
    tier: "planned",
    defaultEnabled: false,
    routes: [],
  },
  {
    id: "veterinaria",
    label: "Veterinaria",
    description: "Ficha y vacunas animales — plugin planificado.",
    tier: "planned",
    defaultEnabled: false,
    routes: [],
  },
];

const PLUGIN_MAP = new Map(PLUGIN_REGISTRY.map((p) => [p.id, p]));

export function getPluginDefinition(id: PluginId): PluginDefinition {
  const def = PLUGIN_MAP.get(id);
  if (!def) throw new Error(`Unknown plugin: ${id}`);
  return def;
}

export function listToggleablePlugins(): PluginDefinition[] {
  return PLUGIN_REGISTRY.filter((p) => p.tier === "optional" || p.tier === "lab");
}

export function pluginForPath(path: string): PluginId | null {
  for (const plugin of PLUGIN_REGISTRY) {
    if (plugin.routes.some((route) => path === route || path.startsWith(`${route}/`))) {
      return plugin.id;
    }
  }
  return null;
}

export const NAV_PLUGIN_BY_FEATURE: Partial<Record<string, PluginId>> = {
  pami: "pami",
  pharmacology: "pharmacology",
  telemedicina: "telemedicina",
  facturacion: "facturacion",
};
