"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "drflow-sidebar-hidden";

type DashboardSidebarContextValue = {
  hidden: boolean;
  setHidden: (value: boolean) => void;
  toggleHidden: () => void;
};

const DashboardSidebarContext = createContext<DashboardSidebarContextValue | null>(null);

export function DashboardSidebarProvider({ children }: { children: ReactNode }) {
  const [hidden, setHiddenState] = useState(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored === "1") setHiddenState(true);
    } catch {
      /* ignore */
    }
  }, []);

  const setHidden = useCallback((value: boolean) => {
    setHiddenState(value);
    try {
      sessionStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleHidden = useCallback(() => {
    setHiddenState((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ hidden, setHidden, toggleHidden }),
    [hidden, setHidden, toggleHidden]
  );

  return (
    <DashboardSidebarContext.Provider value={value}>{children}</DashboardSidebarContext.Provider>
  );
}

export function useDashboardSidebar(): DashboardSidebarContextValue {
  const ctx = useContext(DashboardSidebarContext);
  if (!ctx) {
    return {
      hidden: false,
      setHidden: () => {},
      toggleHidden: () => {},
    };
  }
  return ctx;
}
