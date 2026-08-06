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
    featureId: "profesionales",
    href: "/ingreso-profesionales",
    label: "Medicos",
    permission: "manageStaff",
  },
  {
    type: "group",
    id: "administracion",
    label: "Administración",
    featureId: "administracion",
    children: [
      { featureId: "agenda", href: "/agenda", label: "Agenda", permission: null },
      { featureId: "agenda", href: "/atenciones", label: "Atenciones", permission: null },
      {
        featureId: "administracion",
        href: "/sala-espera",
        label: "Sala de espera",
        permission: "manageWaitingRoom",
      },
      { featureId: "integraciones", href: "/datos", label: "Importar / Exportar", permission: null },
      { featureId: "caja", href: "/caja", label: "Caja", permission: "manageCashRegister" },
    ],
  },
  { featureId: "pacientes", href: "/pacientes", label: "Pacientes", permission: "managePatients" },
  { featureId: "pami", href: "/guia-pami", label: "Guía cabecera PAMI", permission: null },
  {
    featureId: "pami",
    href: "/pami/planillas",
    label: "Planillas PAMI",
    permission: "issuePrescriptions",
  },
  { featureId: "core", href: "/ayuda", label: "Ayuda / Manual", permission: null },
];

/** Flat list of all sidebar links (groups expanded). */
export const FEATURE_NAV_ITEMS: FeatureNavItem[] = flattenNavEntries(FEATURE_NAV_ENTRIES);
