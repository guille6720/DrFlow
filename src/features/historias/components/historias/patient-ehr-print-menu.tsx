"use client";

import { ChevronDown, Loader2, Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { toast } from "@/core/notifications/toast";

import { cn } from "@/shared/utils/cn";

import { usePatientEhrStateContext } from "@/features/historias/components/historias/patient-ehr-state-context";
import { exportPatientClinicalPackage } from "@/features/integraciones/actions/patient-clinical-export";
import {
  downloadBase64File,
  downloadFromUrl,
} from "@/features/integraciones/components/datos/download-file";

export function PatientEhrPrintMenu({
  triggerLabel = "Exportar",
}: {
  /** Visible label on the trigger button. */
  triggerLabel?: string;
}) {
  const { selected, dayPrintConsultations, triggerPrint, printingFullHistory, patientId } =
    usePatientEhrStateContext();
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const busy = printingFullHistory || exporting;

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

  async function handlePrint(scope: "all" | "day", event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
    await triggerPrint(scope);
  }

  async function handlePackage(format: "json" | "zip" | "fhir") {
    setOpen(false);
    if (!patientId) {
      toast.error("No se pudo identificar al paciente.");
      return;
    }
    setExporting(true);
    try {
      const result = await exportPatientClinicalPackage({ patientId, format });
      if (result.error || !result.fileName) {
        toast.error(result.error ?? "No se pudo exportar.");
        return;
      }
      if (result.url) {
        await downloadFromUrl(result.fileName, result.url);
        return;
      }
      if (result.base64 && result.mime) {
        downloadBase64File(result.fileName, result.mime, result.base64);
      }
    } catch {
      toast.error("No se pudo descargar el archivo.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div ref={rootRef} className="relative ml-auto print:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={busy}
        className="drflow-ehr-action-muted inline-flex items-center gap-1 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Printer className="h-3.5 w-3.5" aria-hidden />
        )}
        {busy ? "Preparando…" : triggerLabel}
        <ChevronDown className={cn("h-3.5 w-3.5 transition", open && "rotate-180")} aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Exportar historia clínica"
          className="absolute right-0 top-full z-50 mt-1 min-w-[15rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            disabled={!selected || dayPrintConsultations.length === 0 || busy}
            onClick={(event) => void handlePrint("day", event)}
            className="block w-full px-3 py-2 text-left text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Imprimir historia del día
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={(event) => void handlePrint("all", event)}
            className="block w-full px-3 py-2 text-left text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Exportar historia clínica (PDF)
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busy || !patientId}
            onClick={() => void handlePackage("json")}
            className="block w-full px-3 py-2 text-left text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Exportar JSON estructurado
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busy || !patientId}
            onClick={() => void handlePackage("fhir")}
            className="block w-full px-3 py-2 text-left text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Exportar FHIR R4
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busy || !patientId}
            onClick={() => void handlePackage("zip")}
            className="block w-full px-3 py-2 text-left text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Exportar ZIP completo
          </button>
        </div>
      ) : null}
    </div>
  );
}
