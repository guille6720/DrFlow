"use client";

import { X } from "lucide-react";

import { cn } from "@/shared/utils/cn";

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  /** Ocupa todo el viewport (consulta clínica, flujo largo). */
  fullscreen?: boolean;
  closeDisabled?: boolean;
  headerActions?: React.ReactNode;
};

export function PatientWorkspaceOverlay({
  open,
  title,
  subtitle,
  onClose,
  children,
  wide = false,
  fullscreen = false,
  closeDisabled = false,
  headerActions,
}: Props) {
  if (!open) return null;

  function handleClose() {
    if (closeDisabled) return;
    onClose();
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-[200]",
        fullscreen ? "flex flex-col" : "flex items-end justify-center p-0 sm:items-center sm:p-4"
      )}
    >
      {!fullscreen ? (
        <button
          type="button"
          className="absolute inset-0 bg-slate-900/50"
          aria-label="Cerrar panel"
          onClick={handleClose}
        />
      ) : null}
      <div
        className={cn(
          "relative z-10 flex w-full flex-col bg-white shadow-xl",
          fullscreen
            ? "h-[100dvh] max-h-[100dvh] rounded-none"
            : cn(
                "max-h-[92vh] rounded-t-2xl sm:max-h-[90vh] sm:rounded-2xl",
                wide ? "max-w-4xl" : "max-w-2xl"
              )
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-workspace-overlay-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 id="patient-workspace-overlay-title" className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          {headerActions ? (
            <div className="flex shrink-0 items-center gap-2">{headerActions}</div>
          ) : null}
          <button
            type="button"
            onClick={handleClose}
            disabled={closeDisabled}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6",
            fullscreen && "flex flex-col overflow-hidden"
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
