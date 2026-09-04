import {
  APPEARANCE_MODE_STORAGE_KEY,
  applyUiThemeToDocument,
  CLINICAL_DARK_STORAGE_KEY,
  DEFAULT_UI_STYLE,
  UI_STYLE_STORAGE_KEY,
} from "@/core/theme/ui-theme";

/** Limpia datos locales de NexClinic (tema, portal, QA, etc.). */
export function clearDrFlowClientStorage(): void {
  if (typeof window === "undefined") return;

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("drflow-") || key?.startsWith("drflow_")) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }

  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith("drflow-") || key?.startsWith("drflow_")) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore */
  }

  try {
    localStorage.setItem(UI_STYLE_STORAGE_KEY, DEFAULT_UI_STYLE);
    localStorage.setItem(APPEARANCE_MODE_STORAGE_KEY, "light");
    localStorage.setItem(CLINICAL_DARK_STORAGE_KEY, "0");
  } catch {
    /* ignore */
  }

  applyUiThemeToDocument(DEFAULT_UI_STYLE, false);
}
