"use client";

import { Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";

import { useCanUseFeature } from "@/core/components/entitlements/entitlements-provider";
import { SafeInternalLink } from "@/core/components/safe-link";
import { FEATURES } from "@/core/entitlements/features";

import { cn } from "@/shared/utils/cn";

import { GEMINI_IN_APP_HREF } from "@/features/ia/constants/gemini-web-app";
import { useFeatureFlag } from "@/features/plugins/components/plugins/clinic-features-provider";

type Props = {
  className?: string;
  onNavigate?: () => void;
};

/** Abre Gemini dentro de DrFlow. Nunca sale a gemini.google.com. */
export function GeminiWebAppLink({ className, onNavigate }: Props) {
  const enabled = useFeatureFlag("consultation_assistant");
  const entitled = useCanUseFeature(FEATURES.AI);
  const pathname = usePathname();
  const active = pathname === GEMINI_IN_APP_HREF || pathname.startsWith(`${GEMINI_IN_APP_HREF}/`);
  if (!enabled || !entitled) return null;

  return (
    <SafeInternalLink
      href={GEMINI_IN_APP_HREF}
      aria-label="Abrir Gemini en DrFlow"
      title="Abrir Gemini en DrFlow"
      onClick={() => onNavigate?.()}
      className={cn(
        "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all",
        active
          ? "bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-900 shadow-md shadow-teal-500/20"
          : "text-slate-300 hover:bg-slate-800/90 hover:text-white",
        className
      )}
    >
      <Sparkles
        className={cn("h-5 w-5 shrink-0", active ? "text-slate-900" : "text-violet-400")}
        aria-hidden
      />
      Gemini
    </SafeInternalLink>
  );
}

/** Botón flotante inferior derecho — Gemini dentro de DrFlow. */
export function GeminiWebAppFab() {
  const enabled = useFeatureFlag("consultation_assistant");
  const entitled = useCanUseFeature(FEATURES.AI);
  const pathname = usePathname();
  if (!enabled || !entitled || pathname === GEMINI_IN_APP_HREF) return null;

  return (
    <SafeInternalLink
      href={GEMINI_IN_APP_HREF}
      aria-label="Abrir Gemini en DrFlow"
      title="Abrir Gemini en DrFlow"
      className={cn(
        "fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full",
        "bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-lg shadow-teal-500/30",
        "hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
      )}
    >
      <Sparkles className="h-5 w-5" aria-hidden />
    </SafeInternalLink>
  );
}

export function useGeminiFabVisible(): boolean {
  const enabled = useFeatureFlag("consultation_assistant");
  const entitled = useCanUseFeature(FEATURES.AI);
  return enabled && entitled;
}
