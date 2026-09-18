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

/** Abre Gemini dentro de NexClinic. Nunca sale a gemini.google.com. */
export function GeminiWebAppLink({ className, onNavigate }: Props) {
  const enabled = useFeatureFlag("consultation_assistant");
  const entitled = useCanUseFeature(FEATURES.AI);
  const pathname = usePathname();
  const active = pathname === GEMINI_IN_APP_HREF || pathname.startsWith(`${GEMINI_IN_APP_HREF}/`);
  if (!enabled || !entitled) return null;

  return (
    <SafeInternalLink
      href={GEMINI_IN_APP_HREF}
      aria-label="Abrir Gemini en NexClinic"
      title="Abrir Gemini en NexClinic"
      onClick={() => onNavigate?.()}
      className={cn(
        "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all",
        active
          ? "drflow-sidebar-nav-active bg-gradient-to-r text-white shadow-sm"
          : "text-[var(--text-on-sidebar,#1e293b)] hover:bg-[var(--surface-hover,#f1f5f9)]",
        className
      )}
    >
      <Sparkles
        className={cn(
          "h-5 w-5 shrink-0",
          active ? "text-white" : "text-violet-500"
        )}
        strokeWidth={2.25}
        aria-hidden
      />
      Gemini
    </SafeInternalLink>
  );
}

/** Botón flotante inferior derecho — Gemini dentro de NexClinic. */
export function GeminiWebAppFab() {
  const enabled = useFeatureFlag("consultation_assistant");
  const entitled = useCanUseFeature(FEATURES.AI);
  const pathname = usePathname();
  if (!enabled || !entitled || pathname === GEMINI_IN_APP_HREF) return null;

  return (
    <SafeInternalLink
      href={GEMINI_IN_APP_HREF}
      aria-label="Abrir Gemini en NexClinic"
      title="Abrir Gemini en NexClinic"
      className={cn(
        "fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full",
        "drflow-accent-fill-secondary text-white",
        "hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
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
