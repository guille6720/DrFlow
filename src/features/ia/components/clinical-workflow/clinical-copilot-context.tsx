"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import type { ClinicalCopilotContext } from "@/lib/utils/clinical-copilot";

type CopilotUiContextValue = {
  session: ClinicalCopilotContext;
  setSession: (next: ClinicalCopilotContext) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const ClinicalCopilotUiContext = createContext<CopilotUiContextValue | null>(null);

export function ClinicalCopilotProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ClinicalCopilotContext>({});
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  const value = useMemo(
    () => ({ session, setSession, open, setOpen, toggle }),
    [session, open, toggle]
  );

  return (
    <ClinicalCopilotUiContext.Provider value={value}>{children}</ClinicalCopilotUiContext.Provider>
  );
}

export function useClinicalCopilot() {
  const ctx = useContext(ClinicalCopilotUiContext);
  if (!ctx) {
    return {
      session: {} as ClinicalCopilotContext,
      setSession: () => {},
      open: false,
      setOpen: () => {},
      toggle: () => {},
    };
  }
  return ctx;
}
