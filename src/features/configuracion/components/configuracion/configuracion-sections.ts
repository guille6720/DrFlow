import type { LucideIcon } from "lucide-react";
import {
  Accessibility,
  Activity,
  BookOpen,
  Bot,
  BriefcaseMedical,
  Building2,
  CalendarClock,
  ClipboardList,
  CreditCard,
  Database,
  HeartPulse,
  KeyRound,
  ListTodo,
  Palette,
  Puzzle,
  Scale,
  Settings2,
  Shield,
  Smartphone,
  ToggleLeft,
  Users,
  Wallet,
} from "lucide-react";

import { pamiNavMessages } from "@/locales/es-AR/pami/nav";

export type ConfiguracionSectionId =
  | "clinica"
  | "equipo"
  | "plan"
  | "agenda"
  | "apps"
  | "coberturas"
  | "pami"
  | "guia-pami"
  | "planillas-pami"
  | "ayuda"
  | "apariencia"
  | "asistente-ia"
  | "legal"
  | "demo"
  | "plugins"
  | "flags"
  | "jobs"
  | "observabilidad"
  | "accesibilidad"
  | "api-publica";

export type ConfiguracionGroupId = "consultorio" | "agenda" | "coberturas" | "sistema";

export interface ConfiguracionSectionMeta {
  id: ConfiguracionSectionId;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Ruta externa: abre fuera del panel de configuración inline. */
  href?: string;
}

export interface ConfiguracionGroupMeta {
  id: ConfiguracionGroupId;
  title: string;
  description: string;
  icon: LucideIcon;
  sections: ConfiguracionSectionId[];
}

export const CONFIGURACION_SECTIONS: ConfiguracionSectionMeta[] = [
  {
    id: "clinica",
    title: "Datos de la clínica",
    description: "Nombre, contacto, dirección y duración de turnos.",
    icon: Building2,
  },
  {
    id: "equipo",
    title: "Equipo e invitaciones",
    description: "Invitar médicos, secretaría o administradores.",
    icon: Users,
  },
  {
    id: "plan",
    title: "Tu plan",
    description: "Suscripción DrFlow, trial y pagos con Mercado Pago.",
    icon: CreditCard,
  },
  {
    id: "agenda",
    title: "Agenda y turnos online",
    description: "Reserva pública, horarios semanales y bloqueos.",
    icon: CalendarClock,
  },
  {
    id: "apps",
    title: "Apps móviles",
    description: "DrFlow en tu celular y app de pacientes (PWA).",
    icon: Smartphone,
  },
  {
    id: "coberturas",
    title: "Obras sociales",
    description: "Coberturas aceptadas y prepaga por defecto.",
    icon: Shield,
  },
  {
    id: "pami",
    title: pamiNavMessages.configuracion.setupTitle,
    description: pamiNavMessages.configuracion.setupDescription,
    icon: HeartPulse,
  },
  {
    id: "guia-pami",
    title: pamiNavMessages.configuracion.guiaTitle,
    description: pamiNavMessages.configuracion.guiaDescription,
    icon: HeartPulse,
    href: "/guia-pami",
  },
  {
    id: "planillas-pami",
    title: pamiNavMessages.configuracion.planillasTitle,
    description: pamiNavMessages.configuracion.planillasDescription,
    icon: ClipboardList,
    href: "/pami/planillas",
  },
  {
    id: "ayuda",
    title: "Ayuda / Manual",
    description: "Manual de uso de DrFlow y preguntas frecuentes.",
    icon: BookOpen,
    href: "/ayuda",
  },
  {
    id: "apariencia",
    title: "Apariencia",
    description: "Estilo visual y modo oscuro clínico.",
    icon: Palette,
  },
  {
    id: "asistente-ia",
    title: "Asistente IA",
    description: "Conectá OpenAI, Anthropic, Google Gemini u otro proveedor para el copilot clínico.",
    icon: Bot,
  },
  {
    id: "legal",
    title: "Legal y privacidad",
    description: "Términos, privacidad y cumplimiento normativo.",
    icon: Scale,
  },
  {
    id: "plugins",
    title: "Plugins",
    description: "Activar o desactivar módulos del consultorio sin recompilar.",
    icon: Puzzle,
  },
  {
    id: "flags",
    title: "Feature flags",
    description: "Funciones granulares dentro de los módulos activos.",
    icon: ToggleLeft,
  },
  {
    id: "jobs",
    title: "Cola de trabajos",
    description: "Emails, reportes, importaciones e IA en segundo plano.",
    icon: ListTodo,
  },
  {
    id: "observabilidad",
    title: "Observabilidad",
    description: "Errores, latencia, jobs lentos y health checks.",
    icon: Activity,
  },
  {
    id: "accesibilidad",
    title: "Accesibilidad",
    description: "WCAG AA, teclado, foco visible y lectores de pantalla.",
    icon: Accessibility,
  },
  {
    id: "demo",
    title: "Datos de prueba",
    description: "Pacientes ficticios para probar la agenda y HC.",
    icon: Database,
  },
  {
    id: "api-publica",
    title: "API pública",
    description: "Claves Bearer para integraciones externas (turnos, profesionales).",
    icon: KeyRound,
  },
];

export const CONFIGURACION_GROUPS: ConfiguracionGroupMeta[] = [
  {
    id: "consultorio",
    title: "Consultorio y equipo",
    description: "Datos del consultorio y usuarios del staff.",
    icon: BriefcaseMedical,
    sections: ["clinica", "equipo", "plan"],
  },
  {
    id: "agenda",
    title: "Agenda y pacientes",
    description: "Turnos online, horarios, bloqueos y apps móviles.",
    icon: CalendarClock,
    sections: ["agenda", "apps"],
  },
  {
    id: "coberturas",
    title: pamiNavMessages.configuracion.groupTitle,
    description: pamiNavMessages.configuracion.groupDescription,
    icon: Wallet,
    sections: ["coberturas", "pami", "guia-pami", "planillas-pami", "ayuda"],
  },
  {
    id: "sistema",
    title: "Sistema y legal",
    description: "Apariencia, cumplimiento normativo y datos de prueba.",
    icon: Settings2,
    sections: [
      "apariencia",
      "asistente-ia",
      "legal",
      "plugins",
      "flags",
      "jobs",
      "observabilidad",
      "accesibilidad",
      "api-publica",
      "demo",
    ],
  },
];

const SECTION_BY_ID = new Map(CONFIGURACION_SECTIONS.map((s) => [s.id, s]));

/** Compatibilidad con links antiguos (#equipo, #datos-demo). */
export const CONFIGURACION_HASH_ALIASES: Record<string, ConfiguracionSectionId> = {
  equipo: "equipo",
  "datos-demo": "demo",
};

export function getSectionMeta(id: ConfiguracionSectionId): ConfiguracionSectionMeta | undefined {
  return SECTION_BY_ID.get(id);
}

export function getGroupMeta(id: ConfiguracionGroupId): ConfiguracionGroupMeta | undefined {
  return CONFIGURACION_GROUPS.find((g) => g.id === id);
}

export function getGroupForSection(
  sectionId: ConfiguracionSectionId
): ConfiguracionGroupId | null {
  const group = CONFIGURACION_GROUPS.find((g) => g.sections.includes(sectionId));
  return group?.id ?? null;
}

export function resolveConfiguracionGroup(
  grupo: string | null | undefined
): ConfiguracionGroupId | null {
  if (grupo && CONFIGURACION_GROUPS.some((g) => g.id === grupo)) {
    return grupo as ConfiguracionGroupId;
  }
  return null;
}

export function resolveConfiguracionSection(
  seccion: string | null | undefined,
  hash?: string | null
): ConfiguracionSectionId | null {
  if (seccion && CONFIGURACION_SECTIONS.some((s) => s.id === seccion)) {
    return seccion as ConfiguracionSectionId;
  }
  if (hash && CONFIGURACION_HASH_ALIASES[hash.replace(/^#/, "")]) {
    return CONFIGURACION_HASH_ALIASES[hash.replace(/^#/, "")];
  }
  return null;
}

export function getSectionsForGroup(groupId: ConfiguracionGroupId): ConfiguracionSectionMeta[] {
  const group = getGroupMeta(groupId);
  if (!group) return [];
  return group.sections
    .map((id) => getSectionMeta(id))
    .filter((s): s is ConfiguracionSectionMeta => Boolean(s));
}
