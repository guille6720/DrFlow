"use client";

import { ChevronDown, LayoutDashboard, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DrFlowLogo } from "@/core/components/brand/drflow-logo";
import { SidebarGeminiNavItem } from "@/core/components/layout/sidebar-gemini-nav-item";
import {
  isSidebarNavGroup,
  type SidebarNavEntry,
  type SidebarNavGroup,
  type SidebarNavLink,
} from "@/core/components/layout/sidebar-nav-config";

import { cn } from "@/shared/utils/cn";

function isNavLinkActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarNavLinkItem({
  item,
  pathname,
  onNavigate,
  onPrefetch,
  nested = false,
}: {
  item: SidebarNavLink;
  pathname: string;
  onNavigate: () => void;
  onPrefetch: (href: string) => void;
  nested?: boolean;
}) {
  const active = isNavLinkActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      prefetch
      onMouseEnter={() => onPrefetch(item.href)}
      onFocus={() => onPrefetch(item.href)}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-2xl py-2.5 text-sm font-medium transition-all",
        nested ? "px-3 pl-9" : "px-3",
        active
          ? "bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-900 shadow-md shadow-teal-500/20"
          : "text-slate-300 hover:bg-slate-800/90 hover:text-white"
      )}
    >
      <item.icon
        className={cn("h-5 w-5 shrink-0", active ? "text-slate-900" : "text-teal-400/90")}
      />
      {item.label}
    </Link>
  );
}

function SidebarNavGroupItem({
  group,
  pathname,
  onNavigate,
  onPrefetch,
}: {
  group: SidebarNavGroup;
  pathname: string;
  onNavigate: () => void;
  onPrefetch: (href: string) => void;
}) {
  const childActive = group.children.some((child) => isNavLinkActive(pathname, child.href));
  const [open, setOpen] = useState(childActive);
  const [prevChildActive, setPrevChildActive] = useState(childActive);

  if (childActive !== prevChildActive) {
    setPrevChildActive(childActive);
    if (childActive) setOpen(true);
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all",
          childActive
            ? "bg-slate-800/90 text-white"
            : "text-slate-300 hover:bg-slate-800/90 hover:text-white"
        )}
      >
        <group.icon className="h-5 w-5 shrink-0 text-teal-400/90" />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="space-y-1">
          {group.children.map((child) => (
            <SidebarNavLinkItem
              key={child.href}
              item={child}
              pathname={pathname}
              onNavigate={onNavigate}
              onPrefetch={onPrefetch}
              nested
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

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
  visibleItems: SidebarNavEntry[];
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
        {visibleItems.map((item, index) => (
          <div key={isSidebarNavGroup(item) ? item.id : item.href}>
            {isSidebarNavGroup(item) ? (
              <SidebarNavGroupItem
                group={item}
                pathname={pathname}
                onNavigate={onNavigate}
                onPrefetch={onPrefetch}
              />
            ) : (
              <SidebarNavLinkItem
                item={item}
                pathname={pathname}
                onNavigate={onNavigate}
                onPrefetch={onPrefetch}
              />
            )}
            {index === 0 ? (
              <div className="mt-1">
                <SidebarGeminiNavItem onNavigate={onNavigate} />
              </div>
            ) : null}
          </div>
        ))}
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

export { LayoutDashboard };
