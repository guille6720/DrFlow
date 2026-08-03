export type ClinicalTimelineEventType =
  | "consultation"
  | "vitals"
  | "diagnostic"
  | "treatment"
  | "lab"
  | "imaging"
  | "prescription"
  | "order"
  | "referral"
  | "pami_form"
  | "document"
  | "appointment"
  | "no_show"
  | "hospitalization"
  | "discharge";

export type ClinicalTimelineEvent = {
  id: string;
  type: ClinicalTimelineEventType;
  at: string;
  title: string;
  subtitle?: string;
  meta?: string;
  href?: string;
  recordId?: string;
};

export type ClinicalTimelineFilterId =
  | "all"
  | "consultas"
  | "estudios"
  | "recetas"
  | "ordenes"
  | "archivos";

export const CLINICAL_TIMELINE_FILTER_OPTIONS: {
  id: ClinicalTimelineFilterId;
  label: string;
  types: ClinicalTimelineEventType[] | null;
}[] = [
  { id: "all", label: "Todos", types: null },
  {
    id: "consultas",
    label: "Consultas",
    types: [
      "consultation",
      "vitals",
      "diagnostic",
      "treatment",
      "appointment",
      "hospitalization",
      "discharge",
    ],
  },
  {
    id: "estudios",
    label: "Estudios",
    types: ["lab", "imaging", "order"],
  },
  { id: "recetas", label: "Recetas", types: ["prescription"] },
  {
    id: "ordenes",
    label: "Órdenes",
    types: ["order", "referral", "pami_form"],
  },
  {
    id: "archivos",
    label: "Archivos",
    types: ["document", "lab", "imaging"],
  },
];

export const CLINICAL_TIMELINE_TYPE_LABELS: Record<ClinicalTimelineEventType, string> = {
  consultation: "Consulta",
  vitals: "Signos vitales",
  diagnostic: "Diagnóstico",
  treatment: "Tratamiento",
  lab: "Laboratorio",
  imaging: "Imagenología",
  prescription: "Receta",
  order: "Orden de estudios",
  referral: "Derivación",
  pami_form: "Planilla PAMI",
  document: "Documento",
  appointment: "Turno atendido",
  no_show: "Ausencia",
  hospitalization: "Internación",
  discharge: "Alta",
};
