"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Users,
  FileText,
  ScrollText,
  Pill,
  Bell,
  Video,
  CreditCard,
  BarChart3,
  Settings,
  ClipboardCheck,
  ClipboardList,
  LogOut,
  Menu,
  X,
  HeartPulse,
  ClipboardPlus,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/types/database";
import { hasPermission } from "@/lib/permissions/roles";
import { DrFlowLogo } from "@/components/brand/drflow-logo";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: null },
  { href: "/agenda", label: "Agenda", icon: Calendar, permission: null },
  { href: "/atenciones", label: "Atenciones", icon: ClipboardPlus, permission: null },
  { href: "/pacientes", label: "Pacientes", icon: Users, permission: "managePatients" as const },
  { href: "/historias", label: "Historia clínica", icon: FileText, permission: "viewClinicalRecords" as const },
  { href: "/recetas", label: "Recetas electrónicas", icon: ScrollText, permission: "issuePrescriptions" as const },
  { href: "/herramientas/farmacologia", label: "Guía farmacológica", icon: Pill, permission: "viewPharmacology" as const },
  { href: "/guia-pami", label: "Guía cabecera PAMI", icon: HeartPulse, permission: null },
  { href: "/pami/planillas", label: "Planillas PAMI", icon: ClipboardList, permission: "issuePrescriptions" as const },
  { href: "/recordatorios", label: "Recordatorios", icon: Bell, permission: null },
  { href: "/telemedicina", label: "Telemedicina", icon: Video, permission: null },
  { href: "/pagos", label: "Pagos", icon: CreditCard, permission: "managePayments" as const },
  { href: "/reportes", label: "Reportes", icon: BarChart3, permission: "viewReports" as const },
  { href: "/qa", label: "Checklist QA", icon: ClipboardCheck, permission: "manageSettings" as const },
  { href: "/configuracion", label: "Configuración", icon: Settings, permission: "manageSettings" as const },
];

interface SidebarProps {
  clinicName?: string;
  role: UserRole | null;
  isSuperadmin?: boolean;
}

function SidebarNavContent({
  clinicName,
  visibleItems,
  pathname,
  onNavigate,
  onPrefetch,
}: {
  clinicName?: string;
  visibleItems: typeof navItems;
  pathname: string;
  onNavigate: () => void;
  onPrefetch: (href: string) => void;
}) {
  return (
    <>
      <div className="border-b border-white/10 px-4 py-6">
        <DrFlowLogo size="xl" href="/dashboard" centered />
        <p className="mt-3 truncate text-center text-xs text-blue-200/70">
          {clinicName ?? "Sin clínica"}
        </p>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
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
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-blue-600/90 text-white shadow-md shadow-blue-900/30"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-blue-300" />
              )}
              <item.icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  active ? "text-white" : "text-blue-300 group-hover:text-white"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-5 w-5" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </>
  );
}

export function Sidebar({ clinicName, role, isSuperadmin }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = navItems.filter((item) => {
    if (!item.permission) return true;
    return hasPermission(role, item.permission, isSuperadmin);
  });

  return (
    <>
      <button
        type="button"
        className="fixed left-4 top-4 z-50 rounded-xl bg-blue-700 p-2.5 text-white shadow-lg lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Menú"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col drflow-sidebar-gradient transition-transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarNavContent
          clinicName={clinicName}
          visibleItems={visibleItems}
          pathname={pathname}
          onNavigate={() => setMobileOpen(false)}
          onPrefetch={(href) => router.prefetch(href)}
        />
      </aside>
    </>
  );
}
