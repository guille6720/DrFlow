import type { FeatureModuleId } from "@/features/_shared/registry";

export type FeatureNavPermission =
  | "manageAppointments"
  | "manageSettings"
  | "viewReports"
  | "managePatients"
  | "viewClinicalRecords"
  | "editClinicalRecords"
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

export type FeatureNavGroup = {
  type: "group";
  id: string;
  label: string;
  featureId: FeatureModuleId;
  children: FeatureNavItem[];
};

export type FeatureNavEntry = FeatureNavItem | FeatureNavGroup;

export function isFeatureNavGroup(entry: FeatureNavEntry): entry is FeatureNavGroup {
  return "type" in entry && entry.type === "group";
}

export function flattenNavEntries(entries: FeatureNavEntry[]): FeatureNavItem[] {
  const links: FeatureNavItem[] = [];
  for (const entry of entries) {
    if (isFeatureNavGroup(entry)) {
      links.push(...entry.children);
    } else {
      links.push(entry);
    }
  }
  return links;
}

/** Sidebar navigation — maps routes to feature modules (Phase 3). */
export const FEATURE_NAV_ENTRIES: FeatureNavEntry[] = [
  { featureId: "dashboard", href: "/dashboard", label: "Dashboard", permission: null },
  {
    type: "group",
    id: "medicos",
    label: "Medicos",
    featureId: "profesionales",
    children: [
      {
        featureId: "profesionales",
        href: "/ingreso-profesionales",
        label: "Equipo",
        permission: "manageStaff",
      },
      {
        featureId: "historias",
        href: "/plantillas",
        label: "Plantillas",
        permission: "editClinicalRecords",
      },
      {
        featureId: "recetas",
        href: "/plantillas-recetas",
        label: "Plantillas recetas",
        permission: "issuePrescriptions",
      },
      {
        featureId: "profesionales",
        href: "/firmas",
        label: "Firmas",
        permission: "editClinicalRecords",
      },
    ],
  },
  {
    type: "group",
    id: "administracion",
    label: "Administración",
    featureId: "administracion",
    children: [
      { featureId: "agenda", href: "/turnos/nuevo", label: "Nuevo turno", permission: "manageAppointments" },
      { featureId: "agenda", href: "/turnos/agenda", label: "Agenda", permission: null },
      { featureId: "agenda", href: "/turnos/lista-espera", label: "Lista de espera", permission: "manageAppointments" },
      { featureId: "agenda", href: "/turnos/reportes", label: "Reportes", permission: "viewReports" },
      { featureId: "agenda", href: "/turnos/configuracion", label: "Config. agenda", permission: "manageSettings" },
      { featureId: "agenda", href: "/atenciones", label: "Atenciones", permission: null },
      {
        featureId: "telemedicina",
        href: "/telemedicina",
        label: "Telemedicina",
        permission: "viewClinicalRecords",
      },
      {
        featureId: "administracion",
        href: "/sala-espera",
        label: "Sala de espera",
        permission: "manageWaitingRoom",
      },
      { featureId: "integraciones", href: "/datos", label: "Importar / Exportar", permission: null },
      { featureId: "caja", href: "/caja", label: "Caja", permission: "manageCashRegister" },
      {
        featureId: "facturacion",
        href: "/facturacion/liquidacion",
        label: "Liquidación OS",
        permission: "manageCashRegister",
      },
    ],
  },
  { featureId: "pacientes", href: "/pacientes", label: "Pacientes", permission: "managePatients" },
];

/** Flat list of all sidebar links (groups expanded). */
export const FEATURE_NAV_ITEMS: FeatureNavItem[] = flattenNavEntries(FEATURE_NAV_ENTRIES);
