"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Bell, Building2, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { CommandPaletteTrigger } from "@/core/components/command-palette/command-palette-trigger";

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
      className="flex flex-col gap-3 rounded-xl border border-slate-700/60 bg-slate-900/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      role="region"
      aria-label="Barra operativa del día"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <time dateTime={clock?.iso} className="font-mono font-semibold text-teal-300">
          {clock?.label ?? "Cargando hora…"}
        </time>
        {professionalName ? (
          <span className="inline-flex items-center gap-1.5 text-slate-300">
            <UserRound className="h-4 w-4 text-slate-500" aria-hidden />
            {professionalName}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5 text-slate-400">
          <Building2 className="h-4 w-4 text-slate-500" aria-hidden />
          {clinicName}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <CommandPaletteTrigger compact />
        {notificationCount > 0 ? (
          <Link
            href="#ops-notifications"
            className="inline-flex h-11 items-center gap-1.5 rounded-2xl border border-amber-700/50 bg-amber-950/40 px-3 text-sm text-amber-200 hover:bg-amber-950/60"
            aria-label={`${notificationCount} notificaciones operativas`}
          >
            <Bell className="h-4 w-4" aria-hidden />
            {notificationCount}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
