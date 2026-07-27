export type UiStyleId = "1" | "2";

export const UI_STYLE_STORAGE_KEY = "drflow-ui-style";
export const CLINICAL_DARK_STORAGE_KEY = "drflow-clinical-dark";

export const UI_STYLE_LABELS: Record<UiStyleId, string> = {
  "1": "Estilo 1 — Clínico teal (actual)",
  "2": "Estilo 2 — Flat minimalista + Bento",
};

export function readUiStyleFromStorage(): UiStyleId {
  if (typeof window === "undefined") return "1";
  try {
    const raw = localStorage.getItem(UI_STYLE_STORAGE_KEY);
    return raw === "2" ? "2" : "1";
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
  root.setAttribute("data-ui-style", style);
  if (style === "2") {
    root.setAttribute("data-clinical-dark", clinicalDark ? "1" : "0");
  } else {
    root.removeAttribute("data-clinical-dark");
  }
}

export const UI_THEME_BOOTSTRAP_SCRIPT = `(function(){try{var s=localStorage.getItem("${UI_STYLE_STORAGE_KEY}")||"1";var d=localStorage.getItem("${CLINICAL_DARK_STORAGE_KEY}")==="1";document.documentElement.setAttribute("data-ui-style",s==="2"?"2":"1");if(s==="2")document.documentElement.setAttribute("data-clinical-dark",d?"1":"0");}catch(e){}})();`;
