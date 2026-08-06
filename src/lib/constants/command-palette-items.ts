import type { LucideIcon } from "lucide-react";
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

import type { PERMISSIONS } from "@/core/permissions/roles";

import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

export type CommandPaletteGroup = "acciones" | "navegacion" | "pacientes";

export type CommandPaletteItemDef = {
  id: string;
  label: string;
  description?: string;
  href: string;
  group: CommandPaletteGroup;
  icon: LucideIcon;
  keywords?: string[];
  permission?: keyof typeof PERMISSIONS | null;
};

export const COMMAND_PALETTE_ACTIONS: CommandPaletteItemDef[] = [
  {
    id: "action-new-consultation",
    label: "Nueva consulta",
    description: "Abrir formulario de historia clínica",
    href: "/historias/nueva",
    group: "acciones",
    icon: Stethoscope,
    keywords: ["evolucion", "atender", "consulta"],
    permission: "editClinicalRecords",
  },
  {
    id: "action-new-appointment",
    label: "Nuevo turno",
    href: "/agenda?action=new",
    group: "acciones",
    icon: Calendar,
    keywords: ["agenda", "turno"],
    permission: "manageAppointments",
  },
  {
    id: "action-new-patient",
    label: "Nuevo paciente",
    href: "/pacientes/nuevo",
    group: "acciones",
    icon: Users,
    keywords: ["alta", "paciente"],
    permission: "managePatients",
  },
  {
    id: "action-new-prescription",
    label: "Nueva receta",
    href: "/recetas",
    group: "acciones",
    icon: ScrollText,
    keywords: ["receta", "rx"],
    permission: "issuePrescriptions",
  },
  {
    id: "action-new-order",
    label: "Nueva orden médica",
    href: "/recetas?tipo=orden",
    group: "acciones",
    icon: ClipboardList,
    keywords: ["orden", "estudios"],
    permission: "issuePrescriptions",
  },
  {
    id: "action-attend-now",
    label: "Ir al centro de operaciones",
    description: "Dashboard clínico del día",
    href: "/dashboard",
    group: "acciones",
    icon: LayoutDashboard,
    keywords: ["atender", "hoy", "cola"],
  },
];

export const COMMAND_PALETTE_NAV: CommandPaletteItemDef[] = [
  { id: "nav-dashboard", label: "Dashboard", href: "/dashboard", group: "navegacion", icon: LayoutDashboard },
  { id: "nav-agenda", label: "Agenda", href: "/agenda", group: "navegacion", icon: Calendar },
  {
    id: "nav-waiting-room",
    label: "Sala de espera",
    href: "/sala-espera",
    group: "navegacion",
    icon: Armchair,
    permission: "manageWaitingRoom",
  },
  { id: "nav-atenciones", label: "Atenciones", href: "/atenciones", group: "navegacion", icon: ClipboardPlus },
  {
    id: "nav-pacientes",
    label: "Pacientes",
    href: "/pacientes",
    group: "navegacion",
    icon: Users,
    permission: "managePatients",
  },
  {
    id: "nav-historias",
    label: "Historias clínicas (desde Pacientes)",
    href: "/pacientes?seccion=historias",
    group: "navegacion",
    icon: FileText,
    permission: "viewClinicalRecords",
  },
  {
    id: "nav-recetas",
    label: "Recetas y órdenes (desde Pacientes)",
    href: "/pacientes",
    group: "navegacion",
    icon: ScrollText,
    permission: "issuePrescriptions",
  },
  {
    id: "nav-farmacologia",
    label: "Guía farmacológica",
    href: "/herramientas/farmacologia",
    group: "navegacion",
    icon: Pill,
    permission: "viewPharmacology",
  },
  { id: "nav-pami", label: "Guía cabecera PAMI", href: "/guia-pami", group: "navegacion", icon: HeartPulse },
  {
    id: "nav-planillas-pami",
    label: "Planillas PAMI",
    href: "/pami/planillas",
    group: "navegacion",
    icon: ClipboardList,
    permission: "issuePrescriptions",
  },
  { id: "nav-caja", label: "Caja", href: "/caja", group: "navegacion", icon: Banknote, permission: "manageCashRegister" },
  {
    id: "nav-reportes",
    label: "Reportes",
    href: "/reportes",
    group: "navegacion",
    icon: BarChart3,
    permission: "viewReports",
  },
  {
    id: "nav-config",
    label: "Configuración",
    href: "/configuracion",
    group: "navegacion",
    icon: Settings,
    permission: "manageSettings",
  },
  { id: "nav-datos", label: "Importar / Exportar", href: "/datos", group: "navegacion", icon: ArrowDownUp },
  { id: "nav-recordatorios", label: "Recordatorios", href: "/recordatorios", group: "navegacion", icon: Bell },
  { id: "nav-ayuda", label: "Ayuda / Manual", href: "/ayuda", group: "navegacion", icon: BookOpen },
  {
    id: "nav-ingreso-prof",
    label: "Medicos",
    href: "/ingreso-profesionales",
    group: "navegacion",
    icon: Stethoscope,
    permission: "manageStaff",
    keywords: ["medicos", "profesionales", "ingreso", "staff"],
  },
  {
    id: "nav-docs-admin",
    label: "Docs administrativos",
    href: "/secretaria/documentos",
    group: "navegacion",
    icon: FolderOpen,
    permission: "manageAdminDocuments",
  },
];

export const COMMAND_PALETTE_SHORTCUTS = [
  { keys: "Ctrl+K", label: "Buscar / comandos" },
  { keys: "Ctrl+Shift+N", label: "Nueva SOAP (paciente actual)" },
  { keys: "Ctrl+Shift+R", label: "Nueva receta (paciente actual)" },
  { keys: "Ctrl+Shift+O", label: "Nueva orden (paciente actual)" },
  { keys: "Ctrl+Shift+Enter", label: "Cerrar consulta activa" },
  { keys: "↑ ↓", label: "Navegar resultados" },
  { keys: "Enter", label: "Ejecutar" },
  { keys: "Esc", label: "Cerrar" },
] as const;

/** 1-click actions for the patient currently open in the workspace. */
export function buildPatientContextPaletteActions(patientId: string): CommandPaletteItemDef[] {
  return [
    {
      id: "ctx-soap",
      label: "Nueva SOAP (este paciente)",
      description: "Abrir editor SOAP en panel",
      href: buildPatientWorkspaceUrl(patientId, { tab: "soap", action: "nueva" }),
      group: "acciones",
      icon: Stethoscope,
      keywords: ["soap", "evolucion", "consulta"],
      permission: "editClinicalRecords",
    },
    {
      id: "ctx-rx",
      label: "Nueva receta (este paciente)",
      href: buildPatientWorkspaceUrl(patientId, { tab: "recetas", action: "nueva" }),
      group: "acciones",
      icon: ScrollText,
      keywords: ["receta"],
      permission: "issuePrescriptions",
    },
    {
      id: "ctx-order",
      label: "Nueva orden (este paciente)",
      href: buildPatientWorkspaceUrl(patientId, { tab: "ordenes", action: "nueva" }),
      group: "acciones",
      icon: ClipboardList,
      keywords: ["orden"],
      permission: "issuePrescriptions",
    },
    {
      id: "ctx-chart",
      label: "Ficha del paciente",
      href: `/pacientes/${patientId}`,
      group: "acciones",
      icon: HeartPulse,
      keywords: ["ficha", "resumen"],
      permission: "viewClinicalRecords",
    },
  ];
}
