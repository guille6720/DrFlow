"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/shared/utils/cn";
import { patientWorkflowHref } from "@/lib/utils/clinical-workflow-context";

export type ClinicalContextMenuItem = {
  id: string;
  label: string;
  href?: string;
  onSelect?: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

type MenuState = {
  x: number;
  y: number;
  items: ClinicalContextMenuItem[];
};

export function ClinicalContextMenuHost() {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);

  const close = useCallback(() => setMenu(null), []);

  useEffect(() => {
    function onContextMenu(e: CustomEvent<{ x: number; y: number; items: ClinicalContextMenuItem[] }>) {
      setMenu({ x: e.detail.x, y: e.detail.y, items: e.detail.items });
    }
    window.addEventListener("drflow:context-menu", onContextMenu as EventListener);
    return () => window.removeEventListener("drflow:context-menu", onContextMenu as EventListener);
  }, []);

  useEffect(() => {
    if (!menu) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu, close]);

  if (!menu) return null;

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-[250] min-w-[200px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
      style={{ left: menu.x, top: menu.y }}
    >
      {menu.items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          className={cn(
            "flex w-full px-3 py-2 text-left text-sm transition hover:bg-slate-50 disabled:opacity-50",
            item.destructive ? "text-red-700 hover:bg-red-50" : "text-slate-800"
          )}
          onClick={() => {
            if (item.href) router.push(item.href);
            item.onSelect?.();
            close();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function openClinicalContextMenu(
  e: React.MouseEvent,
  items: ClinicalContextMenuItem[]
) {
  e.preventDefault();
  window.dispatchEvent(
    new CustomEvent("drflow:context-menu", {
      detail: { x: e.clientX, y: e.clientY, items },
    })
  );
}

export function buildPatientContextMenuItems(
  patientId: string,
  opts?: { canIssue?: boolean; canEditClinical?: boolean }
): ClinicalContextMenuItem[] {
  const items: ClinicalContextMenuItem[] = [
    { id: "chart", label: "Abrir ficha", href: patientWorkflowHref(patientId, "chart") },
  ];
  if (opts?.canEditClinical !== false) {
    items.push({ id: "soap", label: "Nueva SOAP", href: patientWorkflowHref(patientId, "soap") });
  }
  if (opts?.canIssue) {
    items.push(
      { id: "rx", label: "Nueva receta", href: patientWorkflowHref(patientId, "prescription") },
      { id: "order", label: "Nueva orden", href: patientWorkflowHref(patientId, "order") }
    );
  }
  items.push({ id: "edit", label: "Editar datos", href: `/pacientes/${patientId}/editar` });
  return items;
}
