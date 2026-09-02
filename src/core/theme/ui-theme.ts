export type UiStyleId = "clinical-blue" | "medical-slate";
export type AppearanceMode = "light" | "dark" | "system";

export const UI_STYLE_STORAGE_KEY = "drflow-ui-style";
export const CLINICAL_DARK_STORAGE_KEY = "drflow-clinical-dark";
export const APPEARANCE_MODE_STORAGE_KEY = "drflow-appearance-mode";

export const UI_STYLE_LABELS: Record<UiStyleId, string> = {
  "clinical-blue": "Clinical Blue",
  "medical-slate": "Medical Slate",
};

/** Official selectable palettes only. Clinical Blue is default. */
export const UI_STYLE_IDS: UiStyleId[] = ["clinical-blue", "medical-slate"];

export const DEFAULT_UI_STYLE: UiStyleId = "clinical-blue";
export const DEFAULT_APPEARANCE_MODE: AppearanceMode = "system";

export function isBentoStyle(_style: UiStyleId): boolean {
  return true;
}

/**
 * Rutas que fuerzan tema claro de marketing / portal paciente.
 * Login y onboarding clínico usan el tema de app (Clinical Blue).
 */
export function isPublicLightPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/planes") return true;
  return /^\/(privacidad|terminos|probar|aviso-paciente|portal|solicitar-turno)(\/|$)/.test(pathname);
}

/** Map legacy style ids / palette names → official palettes. Never throws. */
export function migrateLegacyStyleId(raw: string | null | undefined): UiStyleId {
  if (!raw) return DEFAULT_UI_STYLE;
  if (raw === "clinical-blue" || raw === "2" || raw === "clinical") return "clinical-blue";
  if (raw === "medical-slate" || raw === "6" || raw === "midnight") return "medical-slate";
  // Retired: Estilo 1, Azure, Cobalt, Soft Clinic, and unknown → Clinical Blue
  return DEFAULT_UI_STYLE;
}

export function migrateLegacyAppearanceMode(
  modeRaw: string | null | undefined,
  clinicalDarkRaw: string | null | undefined
): AppearanceMode {
  if (modeRaw === "light" || modeRaw === "dark" || modeRaw === "system") return modeRaw;
  // Legacy clinical-dark only
  if (clinicalDarkRaw === "1") return "dark";
  if (clinicalDarkRaw === "0") return "light";
  return DEFAULT_APPEARANCE_MODE;
}

export function resolveClinicalDark(
  mode: AppearanceMode,
  prefersDark?: boolean
): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  if (typeof prefersDark === "boolean") return prefersDark;
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export function readUiStyleFromStorage(): UiStyleId {
  if (typeof window === "undefined") return DEFAULT_UI_STYLE;
  try {
    return migrateLegacyStyleId(localStorage.getItem(UI_STYLE_STORAGE_KEY));
  } catch {
    return DEFAULT_UI_STYLE;
  }
}

export function readAppearanceModeFromStorage(): AppearanceMode {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE_MODE;
  try {
    return migrateLegacyAppearanceMode(
      localStorage.getItem(APPEARANCE_MODE_STORAGE_KEY),
      localStorage.getItem(CLINICAL_DARK_STORAGE_KEY)
    );
  } catch {
    return DEFAULT_APPEARANCE_MODE;
  }
}

/** @deprecated Prefer readAppearanceModeFromStorage + resolveClinicalDark */
export function readClinicalDarkFromStorage(): boolean {
  return resolveClinicalDark(readAppearanceModeFromStorage());
}

export function applyUiThemeToDocument(style: UiStyleId, clinicalDark: boolean) {
  const root = document.documentElement;
  root.setAttribute("data-ui-style", "2");
  root.setAttribute("data-ui-palette", style);
  root.setAttribute("data-clinical-dark", clinicalDark ? "1" : "0");
  root.style.colorScheme = clinicalDark ? "dark" : "light";
}

export const UI_THEME_BOOTSTRAP_SCRIPT = `(function(){try{var p=location.pathname;var isPublic=p==="/"||p==="/planes"||/^\\/(privacidad|terminos|probar|aviso-paciente|portal|solicitar-turno)(\\/|$)/.test(p);if(isPublic){document.documentElement.setAttribute("data-ui-style", "1");document.documentElement.removeAttribute("data-ui-palette");document.documentElement.removeAttribute("data-clinical-dark");document.documentElement.style.colorScheme="light";return;}var raw=localStorage.getItem("${UI_STYLE_STORAGE_KEY}");var s=(raw==="clinical-blue"||raw==="2"||raw==="clinical")?"clinical-blue":(raw==="medical-slate"||raw==="6"||raw==="midnight")?"medical-slate":"clinical-blue";var modeRaw=localStorage.getItem("${APPEARANCE_MODE_STORAGE_KEY}");var dRaw=localStorage.getItem("${CLINICAL_DARK_STORAGE_KEY}");var mode=(modeRaw==="light"||modeRaw==="dark"||modeRaw==="system")?modeRaw:(dRaw==="1"?"dark":dRaw==="0"?"light":"system");var dark=mode==="dark"?true:mode==="light"?false:window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.setAttribute("data-ui-style","2");document.documentElement.setAttribute("data-ui-palette",s);document.documentElement.setAttribute("data-clinical-dark",dark?"1":"0");document.documentElement.style.colorScheme=dark?"dark":"light";}catch(e){}})();`;
