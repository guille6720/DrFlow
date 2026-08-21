export type UiStyleId = "2" | "3" | "4" | "5" | "6";

export const UI_STYLE_STORAGE_KEY = "drflow-ui-style";
export const CLINICAL_DARK_STORAGE_KEY = "drflow-clinical-dark";

export const UI_STYLE_LABELS: Record<UiStyleId, string> = {
  "2": "Estilo 2 — Clinical Blue + Teal",
  "3": "Estilo 3 — Azul claro + Bento",
  "4": "Estilo 4 — Azul cobalto (fondo saturado)",
  "5": "Estilo 5 — Soft Clinic (pastel + teal)",
  "6": "Estilo 6 — NUEVO Midnight Navy (recomendado)",
};

export const UI_STYLE_IDS: UiStyleId[] = ["6", "2", "3", "4", "5"];

export function isBentoStyle(style: UiStyleId): boolean {
  return style === "2" || style === "3" || style === "4" || style === "5" || style === "6";
}

/**
 * Rutas que fuerzan tema claro de marketing / portal paciente.
 * Login y onboarding clínico usan Midnight Navy (default app).
 */
export function isPublicLightPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/planes") return true;
  return /^\/(privacidad|terminos|probar|aviso-paciente|portal|solicitar-turno)(\/|$)/.test(pathname);
}

export function readUiStyleFromStorage(): UiStyleId {
  if (typeof window === "undefined") return "6";
  try {
    const raw = localStorage.getItem(UI_STYLE_STORAGE_KEY);
    if (raw === "6") return "6";
    if (raw === "5") return "5";
    if (raw === "4") return "4";
    if (raw === "3") return "3";
    if (raw === "2") return "2";
    // Estilo 1 eliminado → Midnight Navy
    if (raw === "1") return "6";
    return "6";
  } catch {
    return "6";
  }
}

export function readClinicalDarkFromStorage(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(CLINICAL_DARK_STORAGE_KEY);
    // Default Midnight: dark on when unset
    if (raw === null) return true;
    return raw === "1";
  } catch {
    return true;
  }
}

export function applyUiThemeToDocument(style: UiStyleId, clinicalDark: boolean) {
  const root = document.documentElement;
  if (style === "6") {
    root.setAttribute("data-ui-style", "2");
    root.setAttribute("data-ui-palette", "midnight");
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

export const UI_THEME_BOOTSTRAP_SCRIPT = `(function(){try{var p=location.pathname;var isPublic=p==="/"||p==="/planes"||/^\\/(privacidad|terminos|probar|aviso-paciente|portal|solicitar-turno)(\\/|$)/.test(p);if(isPublic){document.documentElement.setAttribute("data-ui-style", "1");document.documentElement.removeAttribute("data-ui-palette");document.documentElement.removeAttribute("data-clinical-dark");return;}var s=localStorage.getItem("${UI_STYLE_STORAGE_KEY}")||"6";if(s==="1")s="6";var dRaw=localStorage.getItem("${CLINICAL_DARK_STORAGE_KEY}");var d=dRaw===null?true:dRaw==="1";if(s==="6"){document.documentElement.setAttribute("data-ui-style", "2");document.documentElement.setAttribute("data-ui-palette", "midnight");document.documentElement.setAttribute("data-clinical-dark", d?"1":"0");return;}if(s==="5"){document.documentElement.setAttribute("data-ui-style", "2");document.documentElement.setAttribute("data-ui-palette", "clinicsoft");document.documentElement.setAttribute("data-clinical-dark", d?"1":"0");return;}if(s==="4"){document.documentElement.setAttribute("data-ui-style", "2");document.documentElement.setAttribute("data-ui-palette", "cobalt");document.documentElement.setAttribute("data-clinical-dark", d?"1":"0");return;}if(s==="3"){document.documentElement.setAttribute("data-ui-style", "2");document.documentElement.setAttribute("data-ui-palette", "azure");document.documentElement.setAttribute("data-clinical-dark", d?"1":"0");return;}document.documentElement.removeAttribute("data-ui-palette");document.documentElement.setAttribute("data-ui-style","2");document.documentElement.setAttribute("data-clinical-dark",d?"1":"0");}catch(e){}})();`;
