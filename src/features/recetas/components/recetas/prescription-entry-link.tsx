"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useRctaPrescriptions } from "@/features/recetas/hooks/use-rcta-prescriptions";

type Props = {
  /** Internal editor URL, used when RCTA is disabled for the clinic/user. */
  fallbackHref: string;
  className?: string;
  title?: string;
  prefetch?: boolean;
  onClick?: () => void;
  children: ReactNode;
};

/** "Receta" / "Nueva receta" entry point: opens RCTA in a new tab when enabled, else the internal editor. */
export function PrescriptionEntryLink({ fallbackHref, className, title, prefetch, onClick, children }: Props) {
  const rcta = useRctaPrescriptions();
  if (rcta.enabled) {
    return (
      <a
        href={rcta.href}
        target={rcta.target}
        rel={rcta.rel}
        className={className}
        title={title ?? "Abrir RCTA en una nueva pestaña"}
        onClick={onClick}
        data-rcta-prescription-link=""
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={fallbackHref} prefetch={prefetch} className={className} title={title} onClick={onClick}>
      {children}
    </Link>
  );
}
