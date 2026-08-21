export type UiStyleId = "2" | "3" | "4" | "5" | "6";

export const UI_STYLE_STORAGE_KEY = "drflow-ui-style";
export const CLINICAL_DARK_STORAGE_KEY = "drflow-clinical-dark";

export const UI_STYLE_LABELS: Record<UiStyleId, string> = {
  "2": "Estilo 2 — Clinical Blue + Teal",
  "3": "Estilo 3 — Azul claro + Bento",
  "4": "Estilo 4 — Azul cobalto (fondo saturado)",
  "5": "Estilo 5 — Soft Clinic (pastel + teal)",
  "6": "Estilo 6 — NUEVO Neon Navy (DEPOSITO)",
};

export const UI_STYLE_IDS: UiStyleId[] = ["2", "3", "4", "5", "6"];

export function isBentoStyle(style: UiStyleId): boolean {
  return style === "2" || style === "3" || style === "4" || style === "5" || style === "6";
}

/** Rutas públicas: siempre tema claro original (sin modo oscuro clínico). */
export function isPublicLightPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/planes") return true;
  return /^\/(login|register|demo|privacidad|terminos|probar|aviso-paciente|portal|solicitar-turno|onboarding|acceso-invitado)(\/|$)/.test(
    pathname
  );
}

export function readUiStyleFromStorage(): UiStyleId {
  if (typeof window === "undefined") return "2";
  try {
    const raw = localStorage.getItem(UI_STYLE_STORAGE_KEY);
    if (raw === "6") return "6";
    if (raw === "5") return "5";
    if (raw === "4") return "4";
    if (raw === "3") return "3";
    if (raw === "2") return "2";
    // Estilo 1 eliminado del selector → migrar a Clinical Blue
    if (raw === "1") return "2";
    return "2";
  } catch {
    return "2";
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
  if (style === "6") {
    root.setAttribute("data-ui-style", "2");
    root.setAttribute("data-ui-palette", "neonavio");
    root.setAttribute("data-clinical-dark", clinicalDark ? "1" : "0");
    return;
  }
  if (style === "5") {
    root.setAttribute("data-ui-style", "2");
    root.setAttribute("data-ui-palette", "clinicsoft");
    root.setAttribute("data-clinical-dark", clinicalDark ? "1" : "0");
    return;
  }
  if (style === "4") {
    root.setAttribute("data-ui-style", "2");
    root.setAttribute("data-ui-palette", "cobalt");
    root.setAttribute("data-clinical-dark", clinicalDark ? "1" : "0");
    return;
  }
  if (style === "3") {
    root.setAttribute("data-ui-style", "2");
    root.setAttribute("data-ui-palette", "azure");
    root.setAttribute("data-clinical-dark", clinicalDark ? "1" : "0");
    return;
  }
  root.removeAttribute("data-ui-palette");
  root.setAttribute("data-ui-style", style);
  if (style === "2") {
    root.setAttribute("data-clinical-dark", clinicalDark ? "1" : "0");
  } else {
    root.removeAttribute("data-clinical-dark");
  }
}

export const UI_THEME_BOOTSTRAP_SCRIPT = `(function(){try{var p=location.pathname;var isPublic=p==="/"||p==="/planes"||/^\\/(login|register|demo|privacidad|terminos|probar|aviso-paciente|portal|solicitar-turno|onboarding|acceso-invitado)(\\/|$)/.test(p);if(isPublic){document.documentElement.setAttribute("data-ui-style", "1");document.documentElement.removeAttribute("data-ui-palette");document.documentElement.removeAttribute("data-clinical-dark");return;}var s=localStorage.getItem("${UI_STYLE_STORAGE_KEY}")||"2";if(s==="1")s="2";var d=localStorage.getItem("${CLINICAL_DARK_STORAGE_KEY}")==="1";if(s==="6"){document.documentElement.setAttribute("data-ui-style", "2");document.documentElement.setAttribute("data-ui-palette", "neonavio");document.documentElement.setAttribute("data-clinical-dark", d?"1":"0");return;}if(s==="5"){document.documentElement.setAttribute("data-ui-style", "2");document.documentElement.setAttribute("data-ui-palette", "clinicsoft");document.documentElement.setAttribute("data-clinical-dark", d?"1":"0");return;}if(s==="4"){document.documentElement.setAttribute("data-ui-style", "2");document.documentElement.setAttribute("data-ui-palette", "cobalt");document.documentElement.setAttribute("data-clinical-dark", d?"1":"0");return;}if(s==="3"){document.documentElement.setAttribute("data-ui-style", "2");document.documentElement.setAttribute("data-ui-palette", "azure");document.documentElement.setAttribute("data-clinical-dark", d?"1":"0");return;}document.documentElement.removeAttribute("data-ui-palette");document.documentElement.setAttribute("data-ui-style","2");document.documentElement.setAttribute("data-clinical-dark",d?"1":"0");}catch(e){}})();`;
