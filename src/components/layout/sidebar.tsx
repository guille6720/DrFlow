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
  BarChart3,
  Settings,
  ClipboardList,
  LogOut,
  Menu,
  X,
  HeartPulse,
  ClipboardPlus,
  BookOpen,
  ArrowDownUp,
  PanelLeftClose,
  PanelLeftOpen,
  Banknote,
  Armchair,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/types/database";
import { hasPermission } from "@/lib/permissions/roles";
import { DrFlowLogo } from "@/components/brand/drflow-logo";
import { useDashboardSidebar } from "@/components/layout/dashboard-sidebar-context";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission:
    | "managePatients"
    | "viewClinicalRecords"
    | "issuePrescriptions"
    | "viewPharmacology"
    | "managePayments"
    | "manageCashRegister"
    | "manageWaitingRoom"
    | "manageAdminDocuments"
    | "viewReports"
    | "manageSettings"
    | null;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: null },
  { href: "/agenda", label: "Agenda", icon: Calendar, permission: null },
  { href: "/sala-espera", label: "Sala de espera", icon: Armchair, permission: "manageWaitingRoom" },
  { href: "/atenciones", label: "Atenciones", icon: ClipboardPlus, permission: null },
  { href: "/pacientes", label: "Pacientes", icon: Users, permission: "managePatients" },
  { href: "/caja", label: "Caja", icon: Banknote, permission: "manageCashRegister" },
  { href: "/secretaria/documentos", label: "Docs administrativos", icon: FolderOpen, permission: "manageAdminDocuments" },
  { href: "/historias", label: "Historia clínica", icon: FileText, permission: "viewClinicalRecords" },
  { href: "/datos", label: "Importar / Exportar", icon: ArrowDownUp, permission: null },
  { href: "/recetas", label: "Recetas electrónicas", icon: ScrollText, permission: "issuePrescriptions" },
  { href: "/herramientas/farmacologia", label: "Guía farmacológica", icon: Pill, permission: "viewPharmacology" },
  { href: "/guia-pami", label: "Guía cabecera PAMI", icon: HeartPulse, permission: null },
  { href: "/pami/planillas", label: "Planillas PAMI", icon: ClipboardList, permission: "issuePrescriptions" },
  { href: "/recordatorios", label: "Recordatorios", icon: Bell, permission: null },
  { href: "/reportes", label: "Reportes", icon: BarChart3, permission: "viewReports" },
  { href: "/ayuda", label: "Ayuda / Manual", icon: BookOpen, permission: null },
  { href: "/configuracion", label: "Configuración", icon: Settings, permission: "manageSettings" },
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
  sidebarHidden,
  onToggleSidebarHidden,
}: {
  clinicName?: string;
  visibleItems: NavItem[];
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

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
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

export function Sidebar({ clinicName, role, isSuperadmin }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { hidden: desktopHidden, toggleHidden } = useDashboardSidebar();

  const visibleItems = navItems.filter((item) => {
    if (!item.permission) return true;
    return hasPermission(role, item.permission, isSuperadmin);
  });

  function handleToggleSidebarHidden() {
    toggleHidden();
    setMobileOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className="fixed left-4 top-4 z-50 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-500 p-2.5 text-white shadow-lg shadow-cyan-500/30 lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Menú"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r drflow-ui-sidebar drflow-sidebar-gradient shadow-xl shadow-black/30 transition-transform duration-200 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          desktopHidden ? "lg:-translate-x-full" : "lg:translate-x-0"
        )}
      >
        <SidebarNavContent
          clinicName={clinicName}
          visibleItems={visibleItems}
          pathname={pathname}
          onNavigate={() => setMobileOpen(false)}
          onPrefetch={(href) => router.prefetch(href)}
          sidebarHidden={desktopHidden}
          onToggleSidebarHidden={handleToggleSidebarHidden}
        />
      </aside>
    </>
  );
}
