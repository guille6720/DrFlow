/** Feature module identifiers — vertical slices of DrFlow (Phase 3). */
export type FeatureModuleId =
  | "core"
  | "dashboard"
  | "agenda"
  | "pacientes"
  | "historias"
  | "recetas"
  | "laboratorio"
  | "imagenes"
  | "facturacion"
  | "caja"
  | "ia"
  | "telemedicina"
  | "configuracion"
  | "administracion"
  | "pami"
  | "integraciones"
  | "pharmacology"
  | "portal"
  | "voice"
  | "profesionales"
  | "reportes"
  | "auditoria";

export type FeatureModuleStatus = "ready" | "lab" | "planned";

export type FeatureModuleDef = {
  id: FeatureModuleId;
  label: string;
  routes: string[];
  status: FeatureModuleStatus;
  description: string;
};

export const FEATURE_MODULES: FeatureModuleDef[] = [
  {
    id: "core",
    label: "Core",
    routes: [],
    status: "ready",
    description: "Auth, permisos, tenant scope, guards compartidos.",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    routes: ["/dashboard"],
    status: "ready",
    description: "Centro de operaciones clínicas.",
  },
  {
    id: "agenda",
    label: "Agenda",
    routes: ["/agenda"],
    status: "ready",
    description: "Turnos, calendario y flujo consulta.",
  },
  {
    id: "pacientes",
    label: "Pacientes",
    routes: ["/pacientes"],
    status: "ready",
    description: "Ficha administrativa y workspace clínico.",
  },
  {
    id: "historias",
    label: "Historia clínica",
    routes: ["/historias", "/plantillas"],
    status: "ready",
    description: "Consultas, evoluciones y documentos clínicos.",
  },
  {
    id: "recetas",
    label: "Recetas y órdenes",
    routes: ["/recetas", "/plantillas-recetas"],
    status: "ready",
    description: "Prescripciones y órdenes médicas.",
  },
  {
    id: "laboratorio",
    label: "Laboratorio",
    routes: [],
    status: "planned",
    description: "Integración LIS — pendiente de plugin.",
  },
  {
    id: "imagenes",
    label: "Imágenes",
    routes: [],
    status: "planned",
    description: "Integración PACS/RIS — pendiente de plugin.",
  },
  {
    id: "facturacion",
    label: "Facturación",
    routes: ["/pagos", "/facturacion/liquidacion", "/facturacion/tarifas"],
    status: "ready",
    description: "Liquidación obras sociales y pagos en línea (lab).",
  },
  {
    id: "caja",
    label: "Caja",
    routes: ["/caja", "/caja/cierre", "/caja/reportes", "/caja/cuenta-corriente"],
    status: "ready",
    description: "Cobranzas, cierre y cuenta corriente.",
  },
  {
    id: "ia",
    label: "IA clínica",
    routes: [],
    status: "ready",
    description: "Asistente integrado en paciente y consultas.",
  },
  {
    id: "telemedicina",
    label: "Telemedicina",
    routes: ["/telemedicina"],
    status: "ready",
    description: "Videoconsulta integrada con embed y link para pacientes.",
  },
  {
    id: "configuracion",
    label: "Configuración",
    routes: ["/configuracion"],
    status: "ready",
    description: "Ajustes del consultorio y cumplimiento.",
  },
  {
    id: "administracion",
    label: "Administración",
    routes: ["/secretaria/documentos", "/sala-espera"],
    status: "ready",
    description: "Secretaría, sala de espera y documentos admin.",
  },
  {
    id: "pami",
    label: "PAMI",
    routes: ["/guia-pami", "/pami/planillas"],
    status: "ready",
    description: "Guía cabecera, planillas y vademécum.",
  },
  {
    id: "integraciones",
    label: "Integraciones",
    routes: ["/datos", "/configuracion?grupo=sistema&seccion=api-publica"],
    status: "ready",
    description: "Importación, exportación y API pública v1.",
  },
  {
    id: "pharmacology",
    label: "Farmacología",
    routes: ["/herramientas/farmacologia"],
    status: "ready",
    description: "Guía CIE-10, síntomas y vademécum.",
  },
  {
    id: "portal",
    label: "Portal paciente",
    routes: ["/portal", "/solicitar-turno"],
    status: "ready",
    description: "PWA paciente y reserva pública.",
  },
  {
    id: "voice",
    label: "Voz",
    routes: [],
    status: "ready",
    description: "Dictado por voz en campos clínicos.",
  },
  {
    id: "profesionales",
    label: "Profesionales",
    routes: ["/ingreso-profesionales", "/plantillas", "/firmas"],
    status: "ready",
    description: "Alta y documentación de profesionales.",
  },
  {
    id: "reportes",
    label: "Reportes",
    routes: ["/reportes"],
    status: "ready",
    description: "Informes operativos del consultorio.",
  },
  {
    id: "auditoria",
    label: "Auditoría clínica",
    routes: [],
    status: "ready",
    description: "Trazabilidad inmutable en workspace del paciente.",
  },
];

const MODULE_MAP = new Map(FEATURE_MODULES.map((m) => [m.id, m]));

export function getFeatureModule(id: FeatureModuleId): FeatureModuleDef {
  const mod = MODULE_MAP.get(id);
  if (!mod) throw new Error(`Unknown feature module: ${id}`);
  return mod;
}

export function listReadyFeatureModules(): FeatureModuleDef[] {
  return FEATURE_MODULES.filter((m) => m.status === "ready");
}
