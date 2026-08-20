import {
  Armchair,
  ArrowDownUp,
  Banknote,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  ClipboardList,
  ClipboardPlus,
  FileText,
  FolderOpen,
  HeartPulse,
  LayoutDashboard,
  PenLine,
  Pill,
  ScrollText,
  Settings,
  Sparkles,
  Stethoscope,
  Users,
} from "lucide-react";

import {
  FEATURE_NAV_ENTRIES,
  type FeatureNavEntry,
  type FeatureNavItem,
  isFeatureNavGroup,
  SUPERADMIN_NAV_ENTRIES,
} from "@/features/_shared/nav";

export type SidebarNavLink = FeatureNavItem & {
  icon: typeof LayoutDashboard;
};

export type SidebarNavGroup = {
  type: "group";
  id: string;
  label: string;
  featureId: FeatureNavItem["featureId"];
  icon: typeof LayoutDashboard;
  children: SidebarNavLink[];
};

export type SidebarNavEntry = SidebarNavLink | SidebarNavGroup;

const NAV_ICONS: Record<string, typeof LayoutDashboard> = {
  "/dashboard": LayoutDashboard,
  "/turnos/nuevo": Calendar,
  "/turnos/agenda": Calendar,
  "/turnos/lista-espera": Calendar,
  "/turnos/reportes": BarChart3,
  "/turnos/configuracion": Settings,
  "/agenda": Calendar,
  "/sala-espera": Armchair,
  "/atenciones": ClipboardPlus,
  "/pacientes": Users,
  "/caja": Banknote,
  "/secretaria/documentos": FolderOpen,
  "/ingreso-profesionales": Stethoscope,
  "/consultas": HeartPulse,
  "/plantillas": ClipboardList,
  "/plantillas-recetas": Pill,
  "/firmas": PenLine,
  "/gemini": Sparkles,
  "/historias": FileText,
  "/datos": ArrowDownUp,
  "/recetas": ScrollText,
  "/herramientas/farmacologia": Pill,
  "/guia-pami": HeartPulse,
  "/pami/planillas": ClipboardList,
  "/recordatorios": Bell,
  "/reportes": BarChart3,
  "/ayuda": BookOpen,
  "/configuracion": Settings,
  "/superadmin": Building2,
  "/superadmin/clinics": Building2,
  "/superadmin/plans": BarChart3,
  "/superadmin/features": ClipboardList,
  "/superadmin/usage": BarChart3,
  "/superadmin/recommendations": Sparkles,
};

const GROUP_ICONS: Record<string, typeof LayoutDashboard> = {
  administracion: Building2,
  medicos: Stethoscope,
  superadmin: Building2,
};

function withNavIcon(item: FeatureNavItem): SidebarNavLink {
  return {
    ...item,
    icon: NAV_ICONS[item.href] ?? LayoutDashboard,
  };
}

function mapNavEntry(entry: FeatureNavEntry): SidebarNavEntry {
  if (isFeatureNavGroup(entry)) {
    return {
      type: "group",
      id: entry.id,
      label: entry.label,
      featureId: entry.featureId,
      icon: GROUP_ICONS[entry.id] ?? Building2,
      children: entry.children.map(withNavIcon),
    };
  }
  return withNavIcon(entry);
}

export const SIDEBAR_NAV_ENTRIES: SidebarNavEntry[] = FEATURE_NAV_ENTRIES.map(mapNavEntry);

export const SUPERADMIN_SIDEBAR_NAV_ENTRIES: SidebarNavEntry[] =
  SUPERADMIN_NAV_ENTRIES.map(mapNavEntry);

/** @deprecated Use SIDEBAR_NAV_ENTRIES */
export const SIDEBAR_NAV_ITEMS: SidebarNavLink[] = SIDEBAR_NAV_ENTRIES.flatMap((entry) =>
  isFeatureNavGroup(entry) ? entry.children : [entry]
);

export function isSidebarNavGroup(entry: SidebarNavEntry): entry is SidebarNavGroup {
  return "type" in entry && entry.type === "group";
}
