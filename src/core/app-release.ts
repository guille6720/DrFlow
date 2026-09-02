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
    version: "0.2.27",
    date: "2026-09-02",
    title: "Apariencia: Clinical Blue + Medical Slate",
    highlights: [
      "Únicas paletas oficiales: Clinical Blue (default) y Medical Slate",
      "Modo Claro / Oscuro / Sistema en Configuración → Apariencia",
      "Preferencias antiguas migran automáticamente a Clinical Blue",
    ],
  },
  {
    version: "0.2.24",
    date: "2026-09-01",
    title: "Consultas: HC actualizada al guardar evolución",
    highlights: [
      "Historia clínica del paciente muestra evoluciones recién guardadas desde Consultas",
      "Varias evoluciones del mismo día aparecen en el panel lateral",
      "Al ir a Historia clínica se guarda y recarga con datos frescos",
    ],
  },
  {
    version: "0.2.23",
    date: "2026-09-01",
    title: "Consultas: calendario de fecha sin recorte",
    highlights: [
      "El selector de fecha de evolución se muestra completo al hacer clic en Cambiar",
      "Corrección de ancho del calendario cuando el botón de fecha es angosto",
    ],
  },
  {
    version: "0.2.22",
    date: "2026-09-01",
    title: "Consultas: calendario junto a la fecha de evolución",
    highlights: [
      "El selector de fecha se abre al lado del campo, no al pie de la pantalla",
      "Calendario y hora integrados para cargar evoluciones de fechas anteriores",
    ],
  },
  {
    version: "0.2.21",
    date: "2026-09-01",
    title: "Consultas: fecha de evoluciones anteriores",
    highlights: [
      "Selector de fecha visible al cargar una nueva evolución",
      "La fecha elegida se guarda y actualiza la historia clínica e impresión del día",
      "Podés registrar consultas de fechas pasadas sin perder el autoguardado",
    ],
  },
  {
    version: "0.2.20",
    date: "2026-09-01",
    title: "Consultas: impresión del día y autoguardado al navegar",
    highlights: [
      "Imprimir «Historia del día» usa la consulta en curso, no una evolución anterior",
      "Autoguardado antes de imprimir y al salir de Consultas hacia Historias clínicas",
      "Mismo formato de impresión en toda la historia clínica",
    ],
  },
  {
    version: "0.2.19",
    date: "2026-08-21",
    title: "Entregables a11y/tema (staging review)",
    highlights: [
      "Informe §15: arquitectura, causas, archivos, tokens, patrones, tests — sin deploy a producción",
      "Gate lint/typecheck/build + suite tema; commits de tema aislados del WIP comercial",
      "DrFlow Staging (develop) listo para revisión visual humana",
    ],
  },
  {
    version: "0.2.18",
    date: "2026-08-21",
    title: "Alcance a11y: solo visual/tema (sin lógica)",
    highlights: [
      "Política §14: no tocar Supabase, auth, permisos, entitlements, API, actions ni lógica clínica",
      "scripts/check-a11y-theme-scope.mjs + tests/a11y-scope.test.ts (allowlist / denylist)",
      "Commits de tema deben aislarse del WIP comercial/entitlements",
    ],
  },
  {
    version: "0.2.17",
    date: "2026-08-21",
    title: "Verificación visual manual (checklist + Superadmin)",
    highlights: [
      "QA → Legibilidad visual: settings, theme selector, paciente, HC, agenda, dashboard, forms/tables/modals, Superadmin, sidebar",
      "manual-visual-states.css + shell Superadmin para muted legible en tablas",
      "Canvas de matriz pantalla×paleta + captura Playwright a11y-visual para revisión humana",
    ],
  },
  {
    version: "0.2.16",
    date: "2026-08-21",
    title: "Auditoría a11y automatizada (Playwright + axe)",
    highlights: [
      "e2e/a11y-theme-audit: módulos representativos × desktop/tablet/mobile",
      "Todos los temas clínicos (2–6 × light/dark) en login; sample dashboard/pacientes/config",
      "@axe-core/playwright + muestreo runtime de contraste texto/fondo",
    ],
  },
  {
    version: "0.2.15",
    date: "2026-08-21",
    title: "Tipografía clínica (peso, no sombra)",
    highlights: [
      "typography-states.css: body 400, labels 500, headings 600, buttons 500–600",
      "Sin text-shadow para fingir contraste; el contraste sigue en tokens de color",
      "Marcador required suavizado a 600; no se engrosa el texto clínico de forma global",
    ],
  },
  {
    version: "0.2.14",
    date: "2026-08-21",
    title: "Modales y drawers legibles (islas claras)",
    highlights: [
      "modal-states.css: paneles blancos con títulos/subtítulos/notas/close en ink oscuro",
      "Midnight ya no pinta todos los [role=dialog] como popover oscuro (excluye paneles claros)",
      "Guest appearance, Mi cuenta, workspace overlay y diálogos de agenda usan drflow-modal-panel",
    ],
  },
  {
    version: "0.2.13",
    date: "2026-08-21",
    title: "Estados selected legibles (cards, tabs, menú, filas)",
    highlights: [
      "selected-states.css: pale mint/sky/blue → ink #0F172A; Soft Clinic nav activo teal + blanco",
      "Tabs paciente activos con texto blanco; theme cards selected fuerzan --text-on-selected",
      "EHR sidebar active, dropdown selected y filas hover sin texto casi invisible",
    ],
  },
  {
    version: "0.2.12",
    date: "2026-08-21",
    title: "Formularios legibles: labels, placeholders y disabled",
    highlights: [
      "form-states.css: labels, valores, placeholders (opacity 1), select, textarea, checkbox/radio, errores, helpers, required",
      "Campos disabled sin opacity padre; Input/Select/Textarea con helperText, aria-invalid y * required",
      "Islas claras en dark/Cobalt: ink oscuro + placeholder #64748B",
    ],
  },
  {
    version: "0.2.11",
    date: "2026-08-21",
    title: "Botones legibles en todos los estados",
    highlights: [
      "button-states.css: primary/secondary/outline/ghost/danger con hover, active, focus, disabled y loading",
      "Labels anclados a --text-on-*; loading (aria-busy) sin opacity; Cobalt CTA blanco mantiene azul en hover",
      "Spinner usa currentColor; focus ring doble sobre --surface-page",
    ],
  },
  {
    version: "0.2.10",
    date: "2026-08-21",
    title: "Temas oscuros: contraste cómodo y capas de superficie",
    highlights: [
      "Dark text: #F8FAFC / #CBD5E1 / #94A3B8 en Clinical, Azure, Soft Clinic y Midnight",
      "Sin negros puros: páginas en navy/slate elevados; ladder page→card→elevated, input recessed, hover≠selected",
      "Mesh/cards/inputs/sidebar/selected consumen --surface-* en Clinical Dark",
    ],
  },
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
