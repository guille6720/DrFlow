"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Bell, Building2, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import { CommandPaletteTrigger } from "@/core/components/command-palette/command-palette-trigger";

import { scrollToClinicalOpsSection } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-scroll";

type Props = {
  clinicName: string;
  professionalName?: string | null;
  notificationCount: number;
};

export function ClinicalOpsTopBar({ clinicName, professionalName, notificationCount }: Props) {
  const [clock, setClock] = useState<{ label: string; iso: string } | null>(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock({
        label: format(now, "EEEE d MMM · HH:mm", { locale: es }),
        iso: now.toISOString(),
      });
    };
    tick();
    const timer = setInterval(tick, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="clinical-ops-card flex flex-col gap-3 rounded-xl border border-[var(--border-default,#e2e8f0)] bg-[var(--surface-card,#fff)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      role="region"
      aria-label="Barra operativa del día"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <time
          dateTime={clock?.iso}
          className="font-mono font-semibold text-[var(--sidebar-accent,#0f766e)]"
        >
          {clock?.label ?? "Cargando hora…"}
        </time>
        {professionalName ? (
          <span className="inline-flex items-center gap-1.5 text-[var(--text-primary,#172033)]">
            <UserRound className="h-4 w-4 text-[var(--text-muted,#64748b)]" aria-hidden />
            {professionalName}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary,#475569)]">
          <Building2 className="h-4 w-4 text-[var(--text-muted,#64748b)]" aria-hidden />
          {clinicName}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <CommandPaletteTrigger compact />
        {notificationCount > 0 ? (
          <button
            type="button"
            onClick={() => scrollToClinicalOpsSection("ops-notifications")}
            className="inline-flex h-11 items-center gap-1.5 rounded-2xl border border-amber-200 bg-amber-50 px-3 text-sm text-amber-800 hover:bg-amber-100"
            aria-label={`${notificationCount} notificaciones operativas`}
          >
            <Bell className="h-4 w-4" aria-hidden />
            {notificationCount}
          </button>
        ) : null}
      </div>
    </div>
  );
}
