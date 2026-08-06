import {
  Armchair,
  ArrowDownUp,
  Banknote,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  ClipboardList,
  ClipboardPlus,
  FileText,
  FolderOpen,
  HeartPulse,
  LayoutDashboard,
  Pill,
  ScrollText,
  Settings,
  Stethoscope,
  Users,
} from "lucide-react";

import { FEATURE_NAV_ITEMS, type FeatureNavItem } from "@/features/_shared/nav";

export type SidebarNavItem = FeatureNavItem & {
  icon: typeof LayoutDashboard;
};

const NAV_ICONS: Record<string, typeof LayoutDashboard> = {
  "/dashboard": LayoutDashboard,
  "/agenda": Calendar,
  "/sala-espera": Armchair,
  "/atenciones": ClipboardPlus,
  "/pacientes": Users,
  "/caja": Banknote,
  "/secretaria/documentos": FolderOpen,
  "/ingreso-profesionales": Stethoscope,
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

export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = FEATURE_NAV_ITEMS.map((item) => ({
  ...item,
  icon: NAV_ICONS[item.href] ?? LayoutDashboard,
}));
