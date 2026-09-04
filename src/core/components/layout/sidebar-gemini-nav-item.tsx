"use client";

import { GeminiWebAppLink } from "@/features/ia/components/clinical-workflow/gemini-web-app-link";

type Props = {
  onNavigate?: () => void;
};

/** Sidebar shortcut to Gemini inside NexClinic. */
export function SidebarGeminiNavItem({ onNavigate }: Props) {
  return <GeminiWebAppLink onNavigate={onNavigate} />;
}
