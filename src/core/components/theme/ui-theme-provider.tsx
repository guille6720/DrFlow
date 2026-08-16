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
  applyUiThemeToDocument,
  CLINICAL_DARK_STORAGE_KEY,
  DEFAULT_UI_STYLE,
  readClinicalDarkFromStorage,
  type UiStyleId,
} from "@/core/theme/ui-theme";

type UiThemeContextValue = {
  style: UiStyleId;
  clinicalDark: boolean;
  setStyle: (style: UiStyleId) => void;
  setClinicalDark: (on: boolean) => void;
  isStyle2: boolean;
};

const UiThemeContext = createContext<UiThemeContextValue | null>(null);

export function UiThemeProvider({ children }: { children: ReactNode }) {
  const [clinicalDark, setClinicalDarkState] = useState(false);

  const persist = useCallback((nextDark: boolean) => {
    applyUiThemeToDocument(DEFAULT_UI_STYLE, nextDark);
    try {
      localStorage.setItem(CLINICAL_DARK_STORAGE_KEY, nextDark ? "1" : "0");
    } catch {
      /* private mode */
    }
  }, []);

  const setStyle = useCallback((_next: UiStyleId) => {
    /* Tema único: se ignora el preset. */
  }, []);

  const setClinicalDark = useCallback(
    (on: boolean) => {
      setClinicalDarkState(on);
      persist(on);
    },
    [persist]
  );

  useEffect(() => {
    queueMicrotask(() => {
      const d = readClinicalDarkFromStorage();
      setClinicalDarkState(d);
      applyUiThemeToDocument(DEFAULT_UI_STYLE, d);
    });
  }, []);

  const value = useMemo(
    () => ({
      style: DEFAULT_UI_STYLE,
      clinicalDark,
      setStyle,
      setClinicalDark,
      isStyle2: true,
    }),
    [clinicalDark, setStyle, setClinicalDark]
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
