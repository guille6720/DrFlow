"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { DrFlowLogo } from "@/components/brand/drflow-logo";
import { SIDEBAR_NAV_ITEMS, type SidebarNavItem } from "@/components/layout/sidebar-nav-config";

export function SidebarNavContent({
  clinicName,
  visibleItems,
  pathname,
  onNavigate,
  onPrefetch,
  sidebarHidden,
  onToggleSidebarHidden,
}: {
  clinicName?: string;
  visibleItems: SidebarNavItem[];
  pathname: string;
  onNavigate: () => void;
  onPrefetch: (href: string) => void;
  sidebarHidden: boolean;
  onToggleSidebarHidden: () => void;
}) {
  return (
    <>
      <div className="border-b border-slate-700/80 px-4 py-5">
        <DrFlowLogo size="lg" href="/dashboard" centered />
        <p className="mt-2 truncate text-center text-xs font-medium text-slate-400">
          {clinicName ?? "Sin clínica"}
        </p>
      </div>

      <nav
        id="sidebar-nav"
        aria-label="Navegación principal"
        className="flex-1 space-y-1 overflow-y-auto px-3 py-4"
      >
        {visibleItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              onMouseEnter={() => onPrefetch(item.href)}
              onFocus={() => onPrefetch(item.href)}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-900 shadow-md shadow-teal-500/20"
                  : "text-slate-300 hover:bg-slate-800/90 hover:text-white"
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  active ? "text-slate-900" : "text-teal-400/90"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-slate-700/80 p-3">
        <button
          type="button"
          onClick={onToggleSidebarHidden}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
        >
          {sidebarHidden ? (
            <PanelLeftOpen className="h-5 w-5 text-teal-400" />
          ) : (
            <PanelLeftClose className="h-5 w-5 text-teal-400" />
          )}
          {sidebarHidden ? "Mostrar menú lateral" : "Ocultar menú lateral"}
        </button>
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-red-950/50 hover:text-red-300"
          >
            <LogOut className="h-5 w-5" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </>
  );
}

export { LayoutDashboard, Menu, X };
