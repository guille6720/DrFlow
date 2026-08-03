import type { FeatureModuleId } from "@/features/_shared/registry";

export type FeatureNavPermission =
  | "managePatients"
  | "viewClinicalRecords"
  | "issuePrescriptions"
  | "viewPharmacology"
  | "managePayments"
  | "manageCashRegister"
  | "manageWaitingRoom"
  | "manageAdminDocuments"
  | "manageStaff"
  | "viewReports"
  | "manageSettings"
  | null;

export type FeatureNavItem = {
  featureId: FeatureModuleId;
  href: string;
  label: string;
  permission: FeatureNavPermission;
};

/** Sidebar navigation — maps routes to feature modules (Phase 3). */
export const FEATURE_NAV_ITEMS: FeatureNavItem[] = [
  { featureId: "dashboard", href: "/dashboard", label: "Dashboard", permission: null },
  { featureId: "agenda", href: "/agenda", label: "Agenda", permission: null },
  {
    featureId: "administracion",
    href: "/sala-espera",
    label: "Sala de espera",
    permission: "manageWaitingRoom",
  },
  { featureId: "agenda", href: "/atenciones", label: "Atenciones", permission: null },
  { featureId: "pacientes", href: "/pacientes", label: "Pacientes", permission: "managePatients" },
  { featureId: "caja", href: "/caja", label: "Caja", permission: "manageCashRegister" },
  {
    featureId: "administracion",
    href: "/secretaria/documentos",
    label: "Docs administrativos",
    permission: "manageAdminDocuments",
  },
  {
    featureId: "profesionales",
    href: "/ingreso-profesionales",
    label: "Ingreso de profesionales",
    permission: "manageStaff",
  },
  {
    featureId: "historias",
    href: "/historias",
    label: "Historia clínica",
    permission: "viewClinicalRecords",
  },
  { featureId: "integraciones", href: "/datos", label: "Importar / Exportar", permission: null },
  {
    featureId: "recetas",
    href: "/recetas",
    label: "Recetas y órdenes",
    permission: "issuePrescriptions",
  },
  {
    featureId: "pharmacology",
    href: "/herramientas/farmacologia",
    label: "Guía farmacológica",
    permission: "viewPharmacology",
  },
  { featureId: "pami", href: "/guia-pami", label: "Guía cabecera PAMI", permission: null },
  {
    featureId: "pami",
    href: "/pami/planillas",
    label: "Planillas PAMI",
    permission: "issuePrescriptions",
  },
  { featureId: "agenda", href: "/recordatorios", label: "Recordatorios", permission: null },
  { featureId: "reportes", href: "/reportes", label: "Reportes", permission: "viewReports" },
  { featureId: "core", href: "/ayuda", label: "Ayuda / Manual", permission: null },
  {
    featureId: "configuracion",
    href: "/configuracion",
    label: "Configuración",
    permission: "manageSettings",
  },
];
