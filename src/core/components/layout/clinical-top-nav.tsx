"use client";

import { Calendar, CalendarDays, Stethoscope, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/shared/utils/cn";

const tabs = [
  { href: "/agenda?view=week", label: "Calendario", icon: Calendar, match: (p: string, v: string | null) => p.startsWith("/agenda") && v !== "day" },
  { href: "/agenda?view=day", label: "Agenda", icon: CalendarDays, match: (p: string, v: string | null) => p.startsWith("/agenda") && v === "day" },
  { href: "/pacientes", label: "Pacientes", icon: Users, match: (p: string) => p.startsWith("/pacientes") },
  { href: "/configuracion", label: "Profesionales", icon: Stethoscope, match: (p: string) => p.startsWith("/configuracion") },
];

export function ClinicalTopNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view");

  const show =
    pathname.startsWith("/agenda") ||
    pathname.startsWith("/pacientes") ||
    pathname.startsWith("/configuracion");

  if (!show) return null;

  const dark = true;

  return (
    <nav
      className={cn(
        "drflow-ui-topnav border-b px-4 backdrop-blur-sm sm:px-6",
        dark ? "drflow-ui-topnav-dark" : "drflow-ui-topnav-light"
      )}
    >
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const active = tab.match(pathname, view);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                active
                  ? dark
                    ? "border-teal-400 text-teal-300"
                    : "border-teal-500 text-teal-800"
                  : dark
                    ? "border-transparent text-slate-400 hover:border-slate-600 hover:text-slate-200"
                    : "border-transparent text-slate-500 hover:border-teal-200 hover:text-teal-800"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
