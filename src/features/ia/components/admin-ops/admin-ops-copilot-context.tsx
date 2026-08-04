"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AdminOpsContext } from "@/features/dashboard/utils/admin-ops-types";

type AdminOpsUiContextValue = {
  session: AdminOpsContext;
  setSession: (next: AdminOpsContext) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const AdminOpsCopilotUiContext = createContext<AdminOpsUiContextValue | null>(null);

export function AdminOpsCopilotProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminOpsContext>({});
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  const value = useMemo(
    () => ({ session, setSession, open, setOpen, toggle }),
    [session, open, toggle]
  );

  return (
    <AdminOpsCopilotUiContext.Provider value={value}>{children}</AdminOpsCopilotUiContext.Provider>
  );
}

export function useAdminOpsCopilot() {
  const ctx = useContext(AdminOpsCopilotUiContext);
  if (!ctx) {
    return {
      session: {} as AdminOpsContext,
      setSession: () => {},
      open: false,
      setOpen: () => {},
      toggle: () => {},
    };
  }
  return ctx;
}
