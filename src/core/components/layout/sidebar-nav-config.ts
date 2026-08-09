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
  Stethoscope,
  Users,
} from "lucide-react";

import {
  FEATURE_NAV_ENTRIES,
  type FeatureNavEntry,
  type FeatureNavItem,
  isFeatureNavGroup,
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
  "/agenda": Calendar,
  "/sala-espera": Armchair,
  "/atenciones": ClipboardPlus,
  "/pacientes": Users,
  "/caja": Banknote,
  "/secretaria/documentos": FolderOpen,
  "/ingreso-profesionales": Stethoscope,
  "/plantillas": ClipboardList,
  "/firmas": PenLine,
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
};

const GROUP_ICONS: Record<string, typeof LayoutDashboard> = {
  administracion: Building2,
  medicos: Stethoscope,
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

/** @deprecated Use SIDEBAR_NAV_ENTRIES */
export const SIDEBAR_NAV_ITEMS: SidebarNavLink[] = SIDEBAR_NAV_ENTRIES.flatMap((entry) =>
  isFeatureNavGroup(entry) ? entry.children : [entry]
);

export function isSidebarNavGroup(entry: SidebarNavEntry): entry is SidebarNavGroup {
  return "type" in entry && entry.type === "group";
}
