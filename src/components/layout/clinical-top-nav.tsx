"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { Calendar, CalendarDays, Users, Stethoscope } from "lucide-react";

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

  return (
    <nav className="border-b border-blue-100 bg-white/80 px-4 backdrop-blur-sm sm:px-6">
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const active = tab.match(pathname, view);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors",
                active
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:border-blue-200 hover:text-blue-700"
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
