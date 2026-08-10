"use client";

import { Palette, Settings } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CommandPaletteTrigger } from "@/core/components/command-palette/command-palette-trigger";
import { useDashboardSidebar } from "@/core/components/layout/dashboard-sidebar-context";
import { openGuestAppearanceModal } from "@/core/components/layout/guest-appearance-events";
import { hasPermission, ROLE_LABELS } from "@/core/permissions/roles";

import { cn } from "@/shared/utils/cn";

import type { Clinic, UserRole } from "@/types/database";

import { ClinicSelector } from "./clinic-selector";
import { UserAccountModal } from "./user-account-modal";

interface HeaderProps {
  title: string;
  subtitle?: string;
  /** Links page main landmark to the visible page title (WCAG 2.4.6). */
  titleId?: string;
  clinics: { clinic_id: string; clinic?: Clinic }[];
  activeClinicId?: string | null;
  role: UserRole | null;
  userName?: string;
  isSuperadmin?: boolean;
}

export function Header({
  title,
  subtitle,
  titleId,
  clinics,
  activeClinicId,
  role,
  userName,
  isSuperadmin = false,
}: HeaderProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const showSettings = hasPermission(role, "manageSettings", isSuperadmin);
  const showAppearance = Boolean(role) || isSuperadmin;
  const { hidden: sidebarHidden } = useDashboardSidebar();
  const shellDark = true;

  return (
    <header
      className={cn(
        "drflow-ui-header border-b px-4 py-4 backdrop-blur-sm sm:px-6",
        shellDark ? "drflow-ui-header-dark" : "drflow-ui-header-light",
        sidebarHidden ? "lg:pl-6" : "lg:pl-72"
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="pl-12 lg:pl-0">
          <h1
            id={titleId}
            className={cn(
              "text-xl font-bold tracking-tight sm:text-2xl",
              shellDark ? "text-slate-50" : "text-slate-900"
            )}
          >
            {title}
          </h1>
          {subtitle && (
            <p className={cn("mt-0.5 text-sm", shellDark ? "text-slate-300" : "text-slate-500")}>
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
          {showAppearance && (
            <button
              type="button"
              onClick={openGuestAppearanceModal}
              className={cn(
                "inline-flex h-11 w-11 items-center justify-center rounded-2xl border shadow-sm transition",
                shellDark
                  ? "border-slate-600 bg-slate-800 text-teal-300 hover:border-teal-500/50 hover:bg-slate-700"
                  : "border-slate-200 bg-white text-teal-700 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800"
              )}
              aria-label="Cambiar estilo de la interfaz"
              title="Cambiar estilo"
            >
              <Palette className="h-5 w-5" />
            </button>
          )}
          {showSettings && (
            <Link
              href="/configuracion"
              className={cn(
                "inline-flex h-11 w-11 items-center justify-center rounded-2xl border shadow-sm transition",
                shellDark
                  ? "border-slate-600 bg-slate-800 text-teal-300 hover:border-teal-500/50 hover:bg-slate-700"
                  : "border-slate-200 bg-white text-teal-700 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800"
              )}
              aria-label="Configuración"
              title="Configuración"
            >
              <Settings className="h-5 w-5" />
            </Link>
          )}
          <CommandPaletteTrigger />
          {clinics.length > 1 && activeClinicId && (
            <ClinicSelector clinics={clinics} activeClinicId={activeClinicId} />
          )}
          {userName && (
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className={cn(
                "rounded-2xl border px-4 py-2 text-right shadow-sm transition focus:outline-none focus:ring-2 focus:ring-teal-500/30",
                shellDark
                  ? "border-slate-600 bg-slate-800 hover:border-teal-500/40 hover:bg-slate-700"
                  : "border-slate-200 bg-white hover:border-teal-200 hover:bg-teal-50/80"
              )}
              title="Mi cuenta y permisos"
              aria-label="Abrir mi cuenta"
            >
              <p className={cn("text-sm font-semibold", shellDark ? "text-slate-100" : "text-slate-900")}>
                {userName}
              </p>
              {role && (
                <p className="text-xs font-medium text-teal-400">{ROLE_LABELS[role]}</p>
              )}
            </button>
          )}
        </div>
      </div>
      <UserAccountModal open={profileOpen} onClose={() => setProfileOpen(false)} role={role} />
    </header>
  );
}
