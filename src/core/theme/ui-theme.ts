export type UiStyleId = "1" | "2" | "3" | "4";

export const UI_STYLE_STORAGE_KEY = "drflow-ui-style";
export const CLINICAL_DARK_STORAGE_KEY = "drflow-clinical-dark";

export const UI_STYLE_LABELS: Record<UiStyleId, string> = {
  "1": "Estilo 1 — Azul Médico Clásico",
  "2": "Estilo 2 — Verde Bienestar",
  "3": "Estilo 3 — Minimalismo Moderno",
  "4": "Estilo 4 — Cálido y Empático",
};

export const UI_STYLE_BLURBS: Record<UiStyleId, string> = {
  "1": "Confianza y profesionalidad. Azul profundo en navegación, fondos claros y acentos de acción.",
  "2": "Calma y sanación. Verde esmeralda, menta suave y alertas ámbar.",
  "3": "Claridad y tech. Estructura slate, superficies neutras y errores en rojo nítido.",
  "4": "Cercanía y accesibilidad. Naranja cálido, teal suave y tipografía forestal.",
};

/** Layout Bento (rejilla) — estilos 2–4. */
export function isBentoStyle(style: UiStyleId): boolean {
  return style === "2" || style === "3" || style === "4";
}

/** Todos los presets clínicos admiten modo claro/oscuro. */
export function supportsClinicalDark(_style: UiStyleId): boolean {
  return true;
}

/** Rutas públicas: siempre tema claro original (sin modo oscuro clínico). */
export function isPublicLightPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/planes") return true;
  return /^\/(login|register|demo|privacidad|terminos|probar|aviso-paciente|portal|solicitar-turno|onboarding|acceso-invitado)(\/|$)/.test(
    pathname
  );
}

export function readUiStyleFromStorage(): UiStyleId {
  if (typeof window === "undefined") return "1";
  try {
    const raw = localStorage.getItem(UI_STYLE_STORAGE_KEY);
    if (raw === "4") return "4";
    if (raw === "3") return "3";
    if (raw === "2") return "2";
    return "1";
  } catch {
    return "1";
  }
}

export function readClinicalDarkFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(CLINICAL_DARK_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function applyUiThemeToDocument(style: UiStyleId, clinicalDark: boolean) {
  const root = document.documentElement;
  const dark = clinicalDark ? "1" : "0";

  if (style === "4") {
    root.setAttribute("data-ui-style", "2");
    root.setAttribute("data-ui-palette", "cobalt");
    root.setAttribute("data-clinical-dark", dark);
    return;
  }
  if (style === "3") {
    root.setAttribute("data-ui-style", "2");
    root.setAttribute("data-ui-palette", "azure");
    root.setAttribute("data-clinical-dark", dark);
    return;
  }
  root.removeAttribute("data-ui-palette");
  root.setAttribute("data-ui-style", style);
  root.setAttribute("data-clinical-dark", dark);
}

export const UI_THEME_BOOTSTRAP_SCRIPT = `(function(){try{var p=location.pathname;var isPublic=p==="/"||p==="/planes"||/^\\/(login|register|demo|privacidad|terminos|probar|aviso-paciente|portal|solicitar-turno|onboarding|acceso-invitado)(\\/|$)/.test(p);if(isPublic){document.documentElement.setAttribute("data-ui-style", "1");document.documentElement.removeAttribute("data-ui-palette");document.documentElement.removeAttribute("data-clinical-dark");return;}var s=localStorage.getItem("${UI_STYLE_STORAGE_KEY}")||"1";var d=localStorage.getItem("${CLINICAL_DARK_STORAGE_KEY}")==="1"?"1":"0";if(s==="4"){document.documentElement.setAttribute("data-ui-style", "2");document.documentElement.setAttribute("data-ui-palette", "cobalt");document.documentElement.setAttribute("data-clinical-dark", d);return;}if(s==="3"){document.documentElement.setAttribute("data-ui-style", "2");document.documentElement.setAttribute("data-ui-palette", "azure");document.documentElement.setAttribute("data-clinical-dark", d);return;}document.documentElement.removeAttribute("data-ui-palette");document.documentElement.setAttribute("data-ui-style",s==="2"?"2":"1");document.documentElement.setAttribute("data-clinical-dark",d);}catch(e){}})();`;
