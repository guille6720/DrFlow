"use client";

import { useCallback, useState } from "react";

export type DrappQuickPanelId =
  | "motivo"
  | "evolucion"
  | "diagnostico"
  | "tratamiento"
  | "vitales"
  | "protocolos"
  | null;

function isStickyPanel(panel: DrappQuickPanelId): boolean {
  return panel === "evolucion" || panel === "motivo";
}

function panelDirtyMessage(
  panel: Exclude<DrappQuickPanelId, null | "evolucion" | "motivo" | "protocolos">
): string {
  if (panel === "diagnostico") return "Hay un diagnóstico sin guardar. ¿Descartarlo?";
  if (panel === "tratamiento") return "Hay un tratamiento sin guardar. ¿Descartarlo?";
  return "Hay signos vitales sin guardar. ¿Descartarlos?";
}

function isDirtyConfirmPanel(
  panel: DrappQuickPanelId
): panel is Exclude<DrappQuickPanelId, null | "evolucion" | "motivo" | "protocolos"> {
  return panel === "diagnostico" || panel === "tratamiento" || panel === "vitales";
}

/** One quick clinical panel open at a time, with dirty-close confirmation. */
export function useDrappQuickPanel(initial: DrappQuickPanelId = "evolucion") {
  const [openPanel, setOpenPanel] = useState<DrappQuickPanelId>(initial);
  const [dirty, setDirty] = useState(false);

  const requestOpen = useCallback(
    (next: DrappQuickPanelId) => {
      if (next === openPanel) {
        if (dirty && isDirtyConfirmPanel(openPanel)) {
          if (!window.confirm(panelDirtyMessage(openPanel))) return;
        }
        setDirty(false);
        setOpenPanel(isStickyPanel(next) ? next : null);
        return;
      }

      if (dirty && isDirtyConfirmPanel(openPanel)) {
        if (!window.confirm(panelDirtyMessage(openPanel))) return;
      }
      setDirty(false);
      setOpenPanel(next);
    },
    [dirty, openPanel]
  );

  const closePanel = useCallback(() => {
    if (dirty && isDirtyConfirmPanel(openPanel)) {
      if (!window.confirm(panelDirtyMessage(openPanel))) return false;
    }
    setDirty(false);
    setOpenPanel(null);
    return true;
  }, [dirty, openPanel]);

  const markCleanAndClose = useCallback(() => {
    setDirty(false);
    setOpenPanel(null);
  }, []);

  return {
    openPanel,
    dirty,
    setDirty,
    requestOpen,
    closePanel,
    markCleanAndClose,
  };
}
