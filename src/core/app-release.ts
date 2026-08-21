/**
 * Versión de producto + changelog.
 * Al publicar cambios: subí `version` en package.json y agregá un ítem acá.
 * Eso actualiza el manual, el PDF y dispara el aviso a médicos (web/PWA).
 */
import packageJson from "../../package.json";

export type ChangelogItem = {
  version: string;
  date: string;
  title: string;
  highlights: string[];
};

export const CHANGELOG: ChangelogItem[] = [
  {
    version: "0.2.9",
    date: "2026-08-21",
    title: "Temas claros: texto oscuro en superficies pálidas",
    highlights: [
      "Light modes: --text-primary #0F172A · --text-secondary #334155 · --text-muted #475569 (≥4.5:1 en azul/gris pastel)",
      "Guardas CSS: text-white / slate-50–200 en light → tinta oscura (excepto botones/gradientes)",
      "Cobalt cards y Soft Clinic pastel teal usan ink oscuro; placeholders #64748B solo sobre inputs blancos",
    ],
  },
  {
    version: "0.2.8",
    date: "2026-08-21",
    title: "Tokens semánticos de texto/superficie por paleta",
    highlights: [
      "Contrato único en semantic-tokens.css: text/surface/border en Clinical, Azure, Cobalt, Soft Clinic y Midnight",
      "Primitives (Button, Input, Textarea, EmptyState, Card) consumen --text-* / --surface-* / --border-*",
      "Catálogo TypeScript + test de contrato; a11y-contrast solo remaps de comportamiento",
    ],
  },
  {
    version: "0.2.7",
    date: "2026-08-21",
    title: "Eliminación de opacidades que apagan texto clínico",
    highlights: [
      "Capa anti-patrones: opacity-* en texto y disabled:opacity bajos se neutralizan en .drflow-mesh",
      "Placeholders y botones Midnight sin opacity padre; labels KPI/lab usan --text-muted",
      "Script audit-problematic-css.mts para detectar text-white/xx, rgba bajos y opacity peligrosos",
    ],
  },
  {
    version: "0.2.6",
    date: "2026-08-21",
    title: "WCAG AA contrast floors across Cobalt, Soft Clinic and Midnight",
    highlights: [
      "Texto en página Cobalt ≥4.5:1 (blanco / slate-100 / blue-50)",
      "Soft Clinic: botones y nav activo en #0F766E para texto blanco legible",
      "Midnight: bordes de input #64748B (≥3:1) + suite de contraste ampliada",
    ],
  },
  {
    version: "0.2.5",
    date: "2026-08-21",
    title: "Contraste WCAG AA en todos los presets de apariencia",
    highlights: [
      "Tokens semánticos de texto (--text-primary/secondary/muted) en Midnight, Soft Clinic, Azure, Cobalt y Style 2",
      "Selector de estilo: estados seleccionados siempre legibles (sin texto claro sobre pastel)",
      "Placeholders, labels, errores y botones deshabilitados sin opacity que apague el texto",
    ],
  },
  {
    version: "0.2.4",
    date: "2026-08-21",
    title: "Midnight Navy — sistema visual premium en toda la app",
    highlights: [
      "Estilo 6 Midnight Navy por defecto: navy #07182D, acentos azul/violeta/magenta/cian",
      "Sidebar, header, tarjetas, formularios, tablas y badges unificados con tokens semánticos",
      "Impresión clínica y PDF siguen en layout claro profesional",
    ],
  },
  {
    version: "0.2.3",
    date: "2026-08-21",
    title: "Nuevo Estilo 6 Neon Navy y retiro del Estilo 1",
    highlights: [
      "Estilo 6 Neon Navy (DEPOSITO): navy profundo con magenta, violeta, ámbar y cian",
      "Se eliminó el Estilo 1 del selector de apariencia (quien lo tenía pasa a Estilo 2)",
      "Modo oscuro recomendado al elegir Neon Navy; también disponible en claro",
    ],
  },
  {
    version: "0.2.2",
    date: "2026-08-21",
    title: "Tema Clinical Blue + Teal con modo claro y oscuro",
    highlights: [
      "Estilo 2 recomendado: alto contraste clínico para lectura prolongada",
      "Modo oscuro Clinical Dark con fondo #0B1220 (sin negro puro)",
      "Mejor legibilidad en historia clínica, tablas, botones y formularios",
    ],
  },
  {
    version: "0.2.1",
    date: "2026-08-03",
    title: "Recetas y órdenes por paciente, ingreso de profesionales y consulta unificada",
    highlights: [
      "Hub Recetas y órdenes: buscá paciente, emití receta u orden en un solo lugar",
      "Ingreso de profesionales con panel lateral, perfil, consultorio y rangos horarios",
      "Registro de consulta con un solo campo Evolución y firma automática del médico",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-07-15",
    title: "Manual del médico, aviso de actualizaciones y menú clínico limpio",
    highlights: [
      "Nuevo manual in-app con PDF descargable en Ayuda",
      "Aviso automático cuando hay una versión nueva (web y celular/PWA)",
      "Menú sin Telemedicina, Pagos ni Checklist QA",
      "Atender ahora, renovación de medicación y copy PAMI condicional",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-06-01",
    title: "MVP DrFlow para consultorio",
    highlights: [
      "Agenda, pacientes, historia clínica y recetas",
      "Portal paciente PWA y turnos públicos",
      "Guía PAMI y farmacología por síntomas",
    ],
  },
];

export function getAppVersion(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_VERSION?.trim();
  if (fromEnv) return fromEnv;
  return packageJson.version;
}

export function getBuildId(): string {
  return (
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    getAppVersion()
  );
}

export function getLatestChangelog(): ChangelogItem {
  return CHANGELOG[0];
}

export function getReleasePayload() {
  const latest = getLatestChangelog();
  return {
    version: getAppVersion(),
    buildId: getBuildId(),
    releasedAt: latest.date,
    title: latest.title,
    highlights: latest.highlights,
    manualUpdatedAt: latest.date,
  };
}
