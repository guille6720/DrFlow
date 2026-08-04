"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { UserRole } from "@/types/database";
import { CommandPaletteDialog } from "@/core/components/command-palette/command-palette-dialog";
import { useCommandPaletteState } from "@/core/hooks/use-command-palette-state";

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

  return (
    <CommandPaletteContext.Provider
      value={{ open: state.open, setOpen: state.setOpen, toggle: state.toggle }}
    >
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
