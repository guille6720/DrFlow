"use client";

import { Sparkles } from "lucide-react";

import { cn } from "@/shared/utils/cn";

import { GEMINI_WEB_APP_URL } from "@/features/ia/constants/gemini-web-app";
import { useFeatureFlag } from "@/features/plugins/components/plugins/clinic-features-provider";

type Props = {
  className?: string;
  onNavigate?: () => void;
};

/** Abre Gemini web en una pestaña nueva. */
export function GeminiWebAppLink({ className, onNavigate }: Props) {
  const enabled = useFeatureFlag("consultation_assistant");
  if (!enabled) return null;

  return (
    <a
      href={GEMINI_WEB_APP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Abrir Gemini"
      title="Abrir Gemini"
      onClick={() => onNavigate?.()}
      className={cn(
        "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all",
        "text-slate-300 hover:bg-slate-800/90 hover:text-white",
        className
      )}
    >
      <Sparkles className="h-5 w-5 shrink-0 text-violet-400" aria-hidden />
      Gemini
    </a>
  );
}

/** Botón flotante inferior derecho — acceso directo a Gemini web. */
export function GeminiWebAppFab() {
  const enabled = useFeatureFlag("consultation_assistant");
  if (!enabled) return null;

  return (
    <a
      href={GEMINI_WEB_APP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Abrir Gemini"
      title="Abrir Gemini"
      className={cn(
        "fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full",
        "bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-lg shadow-teal-500/30",
        "hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
      )}
    >
      <Sparkles className="h-5 w-5" aria-hidden />
    </a>
  );
}

export function useGeminiFabVisible(): boolean {
  return useFeatureFlag("consultation_assistant");
}
