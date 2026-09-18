"use client";

import { PanelLeftOpen } from "lucide-react";

import { useDashboardSidebar } from "@/core/components/layout/dashboard-sidebar-context";

/** Botón flotante para volver a abrir el menú cuando está oculto en escritorio. */
export function DashboardSidebarReveal() {
  const { hidden, setHidden } = useDashboardSidebar();

  if (!hidden) return null;

  return (
    <button
      type="button"
      onClick={() => setHidden(false)}
      className="fixed left-4 top-4 z-50 hidden items-center gap-2 rounded-2xl drflow-accent-fill px-4 py-2.5 text-sm font-semibold text-white transition lg:inline-flex"
      aria-label="Mostrar menú de navegación"
    >
      <PanelLeftOpen className="h-4 w-4" />
      Menú
    </button>
  );
}
