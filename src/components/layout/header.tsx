"use client";

import { ROLE_LABELS } from "@/lib/permissions/roles";
import type { Clinic, UserRole } from "@/types/database";
import { ClinicSelector } from "./clinic-selector";

interface HeaderProps {
  title: string;
  subtitle?: string;
  clinics: { clinic_id: string; clinic?: Clinic }[];
  activeClinicId?: string | null;
  role: UserRole | null;
  userName?: string;
}

export function Header({
  title,
  subtitle,
  clinics,
  activeClinicId,
  role,
  userName,
}: HeaderProps) {
  return (
    <header className="border-b border-blue-100/80 bg-gradient-to-r from-white via-blue-50/20 to-white px-4 py-4 sm:px-6 lg:pl-72">
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
          {clinics.length > 1 && activeClinicId && (
            <ClinicSelector clinics={clinics} activeClinicId={activeClinicId} />
          )}
          <div className="rounded-xl border border-blue-100 bg-white px-4 py-2 text-right shadow-sm">
            <p className="text-sm font-semibold text-slate-900">{userName}</p>
            {role && (
              <p className="text-xs font-medium text-blue-700">{ROLE_LABELS[role]}</p>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
