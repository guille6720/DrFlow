"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  APPEARANCE_MODE_STORAGE_KEY,
  type AppearanceMode,
  applyUiThemeToDocument,
  CLINICAL_DARK_STORAGE_KEY,
  DEFAULT_APPEARANCE_MODE,
  DEFAULT_UI_STYLE,
  readAppearanceModeFromStorage,
  readUiStyleFromStorage,
  resolveClinicalDark,
  UI_STYLE_STORAGE_KEY,
  type UiStyleId,
} from "@/core/theme/ui-theme";

type UiThemeContextValue = {
  style: UiStyleId;
  clinicalDark: boolean;
  appearanceMode: AppearanceMode;
  setStyle: (style: UiStyleId) => void;
  setClinicalDark: (on: boolean) => void;
  setAppearanceMode: (mode: AppearanceMode) => void;
  isStyle2: boolean;
};

const UiThemeContext = createContext<UiThemeContextValue | null>(null);

function persistTheme(style: UiStyleId, mode: AppearanceMode, clinicalDark: boolean) {
  applyUiThemeToDocument(style, clinicalDark);
  try {
    localStorage.setItem(UI_STYLE_STORAGE_KEY, style);
    localStorage.setItem(APPEARANCE_MODE_STORAGE_KEY, mode);
    // Keep legacy key in sync for older scripts / e2e helpers
    localStorage.setItem(CLINICAL_DARK_STORAGE_KEY, clinicalDark ? "1" : "0");
  } catch {
    /* private mode */
  }
}

export function UiThemeProvider({ children }: { children: ReactNode }) {
  const [style, setStyleState] = useState<UiStyleId>(DEFAULT_UI_STYLE);
  const [appearanceMode, setAppearanceModeState] =
    useState<AppearanceMode>(DEFAULT_APPEARANCE_MODE);
  const [clinicalDark, setClinicalDarkState] = useState(false);

  const setStyle = useCallback(
    (next: UiStyleId) => {
      setStyleState(next);
      const dark = resolveClinicalDark(appearanceMode);
      setClinicalDarkState(dark);
      persistTheme(next, appearanceMode, dark);
    },
    [appearanceMode]
  );

  const setAppearanceMode = useCallback(
    (mode: AppearanceMode) => {
      setAppearanceModeState(mode);
      const dark = resolveClinicalDark(mode);
      setClinicalDarkState(dark);
      persistTheme(style, mode, dark);
    },
    [style]
  );

  const setClinicalDark = useCallback(
    (on: boolean) => {
      const mode: AppearanceMode = on ? "dark" : "light";
      setAppearanceModeState(mode);
      setClinicalDarkState(on);
      persistTheme(style, mode, on);
    },
    [style]
  );

  useEffect(() => {
    queueMicrotask(() => {
      const s = readUiStyleFromStorage();
      const mode = readAppearanceModeFromStorage();
      const dark = resolveClinicalDark(mode);
      setStyleState(s);
      setAppearanceModeState(mode);
      setClinicalDarkState(dark);
      persistTheme(s, mode, dark);
    });
  }, []);

  useEffect(() => {
    if (appearanceMode !== "system") return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const dark = mq.matches;
      setClinicalDarkState(dark);
      applyUiThemeToDocument(style, dark);
      try {
        localStorage.setItem(CLINICAL_DARK_STORAGE_KEY, dark ? "1" : "0");
      } catch {
        /* ignore */
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [appearanceMode, style]);

  const value = useMemo(
    () => ({
      style,
      clinicalDark,
      appearanceMode,
      setStyle,
      setClinicalDark,
      setAppearanceMode,
      isStyle2: true,
    }),
    [style, clinicalDark, appearanceMode, setStyle, setClinicalDark, setAppearanceMode]
  );

  return <UiThemeContext.Provider value={value}>{children}</UiThemeContext.Provider>;
}

export function useUiTheme() {
  const ctx = useContext(UiThemeContext);
  if (!ctx) {
    throw new Error("useUiTheme must be used within UiThemeProvider");
  }
  return ctx;
}

export function useUiThemeOptional() {
  return useContext(UiThemeContext);
}
