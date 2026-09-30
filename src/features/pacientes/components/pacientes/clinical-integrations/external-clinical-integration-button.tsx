"use client";

import { ExternalLink, type LucideIcon } from "lucide-react";

import { buttonSurfaceClassName } from "@/components/ui/button";

type Props = {
  href: string;
  target: string;
  rel: string;
  label: string;
  /** Accessible name; must say that the link opens in a new tab. */
  ariaLabel: string;
  icon: LucideIcon;
  prioritized: boolean;
  testId: string;
};

/** Plain anchor to an external clinical system. Only the configured URL is used; no patient data. */
export function ExternalClinicalIntegrationButton({
  href,
  target,
  rel,
  label,
  ariaLabel,
  icon: Icon,
  prioritized,
  testId,
}: Props) {
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={buttonSurfaceClassName(
        prioritized ? "primary" : "outline",
        "md",
        "w-full focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 sm:w-auto lg:w-full"
      )}
      data-testid={testId}
      data-prioritized={prioritized ? "true" : "false"}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
      <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden />
    </a>
  );
}
