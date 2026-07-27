"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { DoctorProfileModal } from "./doctor-profile-modal";
import { ROLE_LABELS, hasPermission } from "@/lib/permissions/roles";
import type { Clinic, UserRole } from "@/types/database";
import { ClinicSelector } from "./clinic-selector";
import { cn } from "@/lib/utils/cn";
import { useDashboardSidebar } from "@/components/layout/dashboard-sidebar-context";

interface HeaderProps {
  title: string;
  subtitle?: string;
  clinics: { clinic_id: string; clinic?: Clinic }[];
  activeClinicId?: string | null;
  role: UserRole | null;
  userName?: string;
  isSuperadmin?: boolean;
}

export function Header({
  title,
  subtitle,
  clinics,
  activeClinicId,
  role,
  userName,
  isSuperadmin = false,
}: HeaderProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const showSettings = hasPermission(role, "manageSettings", isSuperadmin);
  const { hidden: sidebarHidden } = useDashboardSidebar();

  return (
    <header
      className={cn(
        "border-b border-slate-200/80 bg-white/90 px-4 py-4 backdrop-blur-sm sm:px-6",
        sidebarHidden ? "lg:pl-6" : "lg:pl-72"
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="pl-12 lg:pl-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {showSettings && (
            <Link
              href="/configuracion"
              className={cn(
                "inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-teal-700 shadow-sm transition",
                "hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800"
              )}
              aria-label="Configuración"
              title="Configuración"
            >
              <Settings className="h-5 w-5" />
            </Link>
          )}
          {clinics.length > 1 && activeClinicId && (
            <ClinicSelector clinics={clinics} activeClinicId={activeClinicId} />
          )}
          {userName && (
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className={cn(
                "rounded-2xl border border-slate-200 bg-white px-4 py-2 text-right shadow-sm transition",
                "hover:border-teal-200 hover:bg-teal-50/80 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              )}
              title="Editar mis datos"
              aria-label="Editar mis datos profesionales"
            >
              <p className="text-sm font-semibold text-slate-900">{userName}</p>
              {role && (
                <p className="text-xs font-medium text-teal-700">{ROLE_LABELS[role]}</p>
              )}
            </button>
          )}
        </div>
      </div>
      <DoctorProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </header>
  );
}
