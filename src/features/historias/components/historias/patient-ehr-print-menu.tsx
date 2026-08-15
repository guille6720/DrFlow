"use client";

import { ChevronDown, Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/shared/utils/cn";

import { usePatientEhrStateContext } from "@/features/historias/components/historias/patient-ehr-state-context";

export function PatientEhrPrintMenu() {
  const { selected, dayPrintConsultations, triggerPrint } = usePatientEhrStateContext();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function handlePrint(scope: "all" | "day", event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    triggerPrint(scope);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative ml-auto print:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="drflow-ehr-action-muted inline-flex items-center gap-1"
      >
        <Printer className="h-3.5 w-3.5" aria-hidden />
        Imprimir
        <ChevronDown className={cn("h-3.5 w-3.5 transition", open && "rotate-180")} aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Opciones de impresión"
          className="absolute right-0 top-full z-50 mt-1 min-w-[15rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            disabled={!selected || dayPrintConsultations.length === 0}
            onClick={(event) => handlePrint("day", event)}
            className="block w-full px-3 py-2 text-left text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Imprimir historia del día
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={(event) => handlePrint("all", event)}
            className="block w-full px-3 py-2 text-left text-slate-800 hover:bg-slate-50"
          >
            Imprimir historia clínica
          </button>
        </div>
      ) : null}
    </div>
  );
}
