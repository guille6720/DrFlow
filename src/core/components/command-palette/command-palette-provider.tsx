"use client";

import dynamic from "next/dynamic";
import { createContext, type ReactNode, useContext, useMemo } from "react";

import { useCommandPaletteState } from "@/core/hooks/use-command-palette-state";

import type { UserRole } from "@/types/database";

const CommandPaletteDialog = dynamic(
  () =>
    import("@/core/components/command-palette/command-palette-dialog").then((mod) => ({
      default: mod.CommandPaletteDialog,
    })),
  { ssr: false }
);

type CommandPaletteContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    return {
      open: false,
      setOpen: () => {},
      toggle: () => {},
    };
  }
  return ctx;
}

type ProviderProps = {
  children: ReactNode;
  role: UserRole | null;
  isSuperadmin?: boolean;
  enabled?: boolean;
};

export function CommandPaletteProvider({
  children,
  role,
  isSuperadmin = false,
  enabled = true,
}: ProviderProps) {
  const state = useCommandPaletteState({ role, isSuperadmin, enabled });

  const contextValue = useMemo(
    () => ({ open: state.open, setOpen: state.setOpen, toggle: state.toggle }),
    [state.open, state.setOpen, state.toggle]
  );

  return (
    <CommandPaletteContext.Provider value={contextValue}>
      {children}
      {enabled ? (
        <CommandPaletteDialog
          open={state.open}
          query={state.query}
          onQueryChange={state.setQuery}
          onClose={() => state.setOpen(false)}
          staticItems={state.staticItems}
          patientHits={state.patientHits}
          loadingPatients={state.loadingPatients}
          selectedIndex={state.selectedIndex}
          onSelectIndex={state.setSelectedIndex}
          onNavigate={state.navigate}
          flatResults={state.flatResults}
        />
      ) : null}
    </CommandPaletteContext.Provider>
  );
}
