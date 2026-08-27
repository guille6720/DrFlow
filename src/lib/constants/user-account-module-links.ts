import { PERMISSIONS } from "@/core/permissions/roles";

/** Nav links for Mi cuenta — kept out of "use server" modules (Next only allows async fn exports). */
export const USER_ACCOUNT_MODULE_LINKS: {
  href: string;
  label: string;
  permission: keyof typeof PERMISSIONS | null;
}[] = [
  { href: "/dashboard", label: "Dashboard", permission: null },
  { href: "/agenda", label: "Agenda", permission: null },
  { href: "/sala-espera", label: "Sala de espera", permission: "manageWaitingRoom" },
  { href: "/pacientes", label: "Pacientes", permission: "managePatients" },
  { href: "/caja", label: "Caja / Cobranzas", permission: "manageCashRegister" },
  { href: "/facturacion/liquidacion", label: "Liquidación obras sociales", permission: "manageCashRegister" },
  { href: "/secretaria/documentos", label: "Documentos administrativos", permission: "manageAdminDocuments" },
  { href: "/historias", label: "Historia clínica", permission: "viewClinicalRecords" },
  { href: "/consultas", label: "Consultas", permission: "editClinicalRecords" },
  { href: "/telemedicina", label: "Telemedicina", permission: "viewClinicalRecords" },
  { href: "/recetas", label: "Recetas", permission: "issuePrescriptions" },
  { href: "/herramientas/farmacologia", label: "Farmacología", permission: "viewPharmacology" },
  { href: "/gemini", label: "Asistente IA", permission: "viewClinicalRecords" },
  { href: "/recordatorios", label: "Recordatorios WhatsApp", permission: "manageAppointments" },
  { href: "/pami/planillas", label: "Planillas PAMI", permission: "manageSettings" },
  { href: "/reportes", label: "Reportes", permission: "viewReports" },
  { href: "/reportes/bi", label: "Reportes avanzados", permission: "viewReports" },
  { href: "/configuracion", label: "Configuración y equipo", permission: "manageSettings" },
];
