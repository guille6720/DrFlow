export type WcagFeatureStatus = "done" | "partial" | "planned";

export type WcagFeature = {
  id: string;
  label: string;
  description: string;
  status: WcagFeatureStatus;
  criterion?: string;
};

/** WCAG 2.1 AA features implemented or tracked in DrFlow. */
export const WCAG_AA_FEATURES: WcagFeature[] = [
  {
    id: "lang",
    label: "Idioma de la página",
    description: "HTML lang=\"es\" para lectores de pantalla.",
    status: "done",
    criterion: "3.1.1",
  },
  {
    id: "skip-link",
    label: "Saltar al contenido",
    description: "Enlace visible al recibir foco con teclado.",
    status: "done",
    criterion: "2.4.1",
  },
  {
    id: "landmarks",
    label: "Regiones y landmarks",
    description: "main, nav y modales con roles/labels ARIA.",
    status: "done",
    criterion: "1.3.1",
  },
  {
    id: "focus-visible",
    label: "Foco visible",
    description: "Anillo de foco con :focus-visible en controles interactivos.",
    status: "done",
    criterion: "2.4.7",
  },
  {
    id: "keyboard",
    label: "Navegación por teclado",
    description: "Paleta de comandos, modales y sidebar operables sin mouse.",
    status: "done",
    criterion: "2.1.1",
  },
  {
    id: "reduced-motion",
    label: "Movimiento reducido",
    description: "Respeta prefers-reduced-motion del sistema.",
    status: "done",
    criterion: "2.3.3",
  },
  {
    id: "live-regions",
    label: "Anuncios de ruta",
    description: "Cambios de pantalla anunciados en región aria-live.",
    status: "done",
    criterion: "4.1.3",
  },
  {
    id: "contrast",
    label: "Contraste de color",
    description: "Paleta clínica con ratios AA en textos principales.",
    status: "partial",
    criterion: "1.4.3",
  },
];

export type KeyboardShortcut = {
  keys: string;
  action: string;
  context?: string;
};

export const APP_KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { keys: "Tab / Shift+Tab", action: "Navegar entre controles", context: "Global" },
  { keys: "Enter / Espacio", action: "Activar botón o enlace", context: "Global" },
  { keys: "Ctrl+K", action: "Paleta de comandos / búsqueda global", context: "Dashboard" },
  { keys: "Ctrl+Shift+N", action: "Nueva SOAP (paciente actual) o abrir paleta", context: "Dashboard" },
  { keys: "Ctrl+Shift+R", action: "Nueva receta (paciente actual)", context: "Ficha paciente" },
  { keys: "Ctrl+Shift+O", action: "Nueva orden (paciente actual)", context: "Ficha paciente" },
  { keys: "Ctrl+Shift+Enter", action: "Cerrar consulta (turno activo)", context: "Consulta en curso" },
  { keys: "↑ / ↓", action: "Navegar resultados", context: "Paleta de comandos" },
  { keys: "Esc", action: "Cerrar diálogo o menú", context: "Modales" },
];

export const REDUCED_MOTION_STORAGE_KEY = "drflow-a11y-reduced-motion";
