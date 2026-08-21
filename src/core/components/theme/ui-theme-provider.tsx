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
  isBentoStyle,
  readClinicalDarkFromStorage,
  readUiStyleFromStorage,
  UI_STYLE_STORAGE_KEY,
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
  const [style, setStyleState] = useState<UiStyleId>("2");
  const [clinicalDark, setClinicalDarkState] = useState(false);

  const persist = useCallback((nextStyle: UiStyleId, nextDark: boolean) => {
    applyUiThemeToDocument(nextStyle, nextDark);
    try {
      localStorage.setItem(UI_STYLE_STORAGE_KEY, nextStyle);
      if (isBentoStyle(nextStyle)) {
        localStorage.setItem(CLINICAL_DARK_STORAGE_KEY, nextDark ? "1" : "0");
      }
    } catch {
      /* private mode */
    }
  }, []);

  const setStyle = useCallback(
    (next: UiStyleId) => {
      setStyleState(next);
      // Neon Navy (DEPOSITO): arrancar en oscuro (referencia).
      if (next === "6") {
        setClinicalDarkState(true);
        persist(next, true);
        return;
      }
      // Paletas claras: arrancar en claro para que se note el cambio de colores.
      if (next === "2" || next === "5") {
        setClinicalDarkState(false);
        persist(next, false);
        return;
      }
      const dark = isBentoStyle(next) ? clinicalDark : false;
      persist(next, dark);
    },
    [clinicalDark, persist]
  );

  const setClinicalDark = useCallback(
    (on: boolean) => {
      if (!isBentoStyle(style)) return;
      setClinicalDarkState(on);
      persist(style, on);
    },
    [persist, style]
  );

  useEffect(() => {
    queueMicrotask(() => {
      const s = readUiStyleFromStorage();
      const d = readClinicalDarkFromStorage();
      setStyleState(s);
      setClinicalDarkState(d);
      applyUiThemeToDocument(s, d);
    });
  }, []);

  const value = useMemo(
    () => ({
      style,
      clinicalDark,
      setStyle,
      setClinicalDark,
      isStyle2: isBentoStyle(style),
    }),
    [style, clinicalDark, setStyle, setClinicalDark]
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
