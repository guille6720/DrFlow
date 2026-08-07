"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

import { dismissToast } from "@/core/notifications/toast-store";
import type { ToastRecord } from "@/core/notifications/toast-types";

import { cn } from "@/shared/utils/cn";

type Props = {
  toast: ToastRecord;
};

const toneStyles = {
  success: {
    container: "border-emerald-200 bg-emerald-50 text-emerald-950",
    icon: "bg-emerald-600 text-white",
    progress: "bg-emerald-500/70",
    Icon: CheckCircle2,
  },
  error: {
    container: "border-red-200 bg-red-50 text-red-950",
    icon: "bg-red-600 text-white",
    progress: "bg-red-500/70",
    Icon: AlertCircle,
  },
  info: {
    container: "border-slate-200 bg-white text-slate-900",
    icon: "bg-slate-700 text-white",
    progress: "bg-slate-400/70",
    Icon: Info,
  },
} as const;

export function ToastItem({ toast }: Props) {
  const styles = toneStyles[toast.tone];
  const Icon = styles.Icon;
  const isError = toast.tone === "error";
  const showProgress = toast.duration > 0;

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-atomic="true"
      className={cn(
        "pointer-events-auto overflow-hidden rounded-2xl border p-4 shadow-lg shadow-slate-900/10",
        "motion-safe:[animation:drflow-toast-in_200ms_ease-out]",
        styles.container
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
            styles.icon
          )}
          aria-hidden
        >
          <Icon className="h-4 w-4" />
        </span>
        <p className="min-w-0 flex-1 pt-0.5 text-sm leading-snug">{toast.message}</p>
        {toast.dismissible ? (
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-black/5 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            aria-label={`Cerrar notificación: ${toast.message}`}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
      {showProgress ? (
        <div
          className="mt-3 h-1 overflow-hidden rounded-full bg-black/10 motion-reduce:hidden"
          aria-hidden
        >
          <div
            className={cn("h-full origin-left", styles.progress)}
            style={{
              animation: `drflow-toast-progress ${toast.duration}ms linear forwards`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
