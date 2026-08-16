/** Único tema clínico DrFlow (teal unificado + Bento). */
export type UiStyleId = "2";

export const UI_STYLE_STORAGE_KEY = "drflow-ui-style";
export const CLINICAL_DARK_STORAGE_KEY = "drflow-clinical-dark";

export const DEFAULT_UI_STYLE: UiStyleId = "2";

export const UI_STYLE_LABEL = "Teal clínico";
export const UI_STYLE_BLURB =
  "Sidebar clara, acento teal y superficies neutras. Incluye modo claro y oscuro.";

/** Layout Bento activo en el tema único. */
export function isBentoStyle(_style: UiStyleId = DEFAULT_UI_STYLE): boolean {
  return true;
}

export function supportsClinicalDark(_style: UiStyleId = DEFAULT_UI_STYLE): boolean {
  return true;
}

/** Rutas públicas: siempre tema claro (sin modo oscuro clínico). */
export function isPublicLightPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/planes") return true;
  return /^\/(login|register|demo|privacidad|terminos|probar|aviso-paciente|portal|solicitar-turno|onboarding|acceso-invitado)(\/|$)/.test(
    pathname
  );
}

/** Compat: siempre el tema único (ignora presets viejos 1/3/4). */
export function readUiStyleFromStorage(): UiStyleId {
  return DEFAULT_UI_STYLE;
}

export function readClinicalDarkFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(CLINICAL_DARK_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function applyUiThemeToDocument(_style: UiStyleId, clinicalDark: boolean) {
  const root = document.documentElement;
  root.removeAttribute("data-ui-palette");
  root.setAttribute("data-ui-style", DEFAULT_UI_STYLE);
  root.setAttribute("data-clinical-dark", clinicalDark ? "1" : "0");
}

export const UI_THEME_BOOTSTRAP_SCRIPT = `(function(){try{var p=location.pathname;var isPublic=p==="/"||p==="/planes"||/^\\/(login|register|demo|privacidad|terminos|probar|aviso-paciente|portal|solicitar-turno|onboarding|acceso-invitado)(\\/|$)/.test(p);if(isPublic){document.documentElement.setAttribute("data-ui-style", "2");document.documentElement.removeAttribute("data-ui-palette");document.documentElement.removeAttribute("data-clinical-dark");return;}var d=localStorage.getItem("${CLINICAL_DARK_STORAGE_KEY}")==="1"?"1":"0";document.documentElement.removeAttribute("data-ui-palette");document.documentElement.setAttribute("data-ui-style","${DEFAULT_UI_STYLE}");document.documentElement.setAttribute("data-clinical-dark",d);}catch(e){}})();`;
