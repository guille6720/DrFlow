import type {
  DiagnosisAssociationRule,
  RelatedActionDefinition,
} from "@/features/historias/clinical-suggestions/types";

/**
 * Catálogo de acciones reutilizables (sin dosis ni fármacos).
 * Ampliar aquí sin tocar el núcleo de HC.
 */
export const RELATED_ACTION_DEFINITIONS: Record<string, RelatedActionDefinition> = {
  control_pa: {
    id: "control_pa",
    label: "Control de PA",
    kind: "control",
    hint: "Acceso rápido a conducta de seguimiento",
    applyAs: {
      type: "clinical_treatment",
      product: "Control de PA",
      treatmentKind: "conduct",
      category: "Control",
    },
  },
  solicitar_laboratorio: {
    id: "solicitar_laboratorio",
    label: "Solicitar laboratorio",
    kind: "lab",
    applyAs: {
      type: "clinical_treatment",
      product: "Solicitar laboratorio",
      treatmentKind: "conduct",
      category: "Estudio",
    },
  },
  ecg: {
    id: "ecg",
    label: "ECG",
    kind: "study",
    applyAs: {
      type: "clinical_treatment",
      product: "ECG",
      treatmentKind: "conduct",
      category: "Estudio",
    },
  },
  mapa: {
    id: "mapa",
    label: "MAPA",
    kind: "study",
    applyAs: {
      type: "clinical_treatment",
      product: "MAPA",
      treatmentKind: "conduct",
      category: "Estudio",
    },
  },
  interconsulta: {
    id: "interconsulta",
    label: "Interconsulta",
    kind: "interconsult",
    applyAs: {
      type: "clinical_treatment",
      product: "Interconsulta",
      treatmentKind: "conduct",
      category: "Derivación",
    },
  },
  control_glucemia: {
    id: "control_glucemia",
    label: "Control de glucemia",
    kind: "control",
    applyAs: {
      type: "clinical_treatment",
      product: "Control de glucemia",
      treatmentKind: "conduct",
      category: "Control",
    },
  },
  educacion_diabetes: {
    id: "educacion_diabetes",
    label: "Educación diabetológica",
    kind: "conduct",
    applyAs: {
      type: "clinical_treatment",
      product: "Educación diabetológica",
      treatmentKind: "non_pharmacologic",
      category: "Educación",
    },
  },
  fondo_de_ojo: {
    id: "fondo_de_ojo",
    label: "Fondo de ojo",
    kind: "study",
    applyAs: {
      type: "clinical_treatment",
      product: "Fondo de ojo",
      treatmentKind: "conduct",
      category: "Estudio",
    },
  },
  antihipertensivo: {
    id: "antihipertensivo",
    label: "Antihipertensivo",
    kind: "pharmacologic",
    applyAs: {
      type: "clinical_treatment",
      product: "Antihipertensivo",
      treatmentKind: "pharmacologic",
      category: "Farmacológicos",
    },
  },
  diuretico: {
    id: "diuretico",
    label: "Diurético",
    kind: "pharmacologic",
    applyAs: {
      type: "clinical_treatment",
      product: "Diurético",
      treatmentKind: "pharmacologic",
      category: "Farmacológicos",
    },
  },
  dieta_hiposodica: {
    id: "dieta_hiposodica",
    label: "Dieta hiposódica",
    kind: "non_pharmacologic",
    applyAs: {
      type: "clinical_treatment",
      product: "Dieta hiposódica",
      treatmentKind: "non_pharmacologic",
      category: "No farmacológicos",
    },
  },
  optimizar_hta: {
    id: "optimizar_hta",
    label: "Optimizar antihipertensivos",
    kind: "conduct",
    applyAs: {
      type: "clinical_treatment",
      product: "Optimizar antihipertensivos",
      treatmentKind: "conduct",
      category: "Conductas",
    },
  },
  evaluar_zenith: {
    id: "evaluar_zenith",
    label: "Evaluar estudio ZENITH",
    kind: "conduct",
    hint: "Screening HTA no controlada NCT07181109",
    applyAs: {
      type: "clinical_treatment",
      product: "Evaluar estudio ZENITH",
      treatmentKind: "conduct",
      category: "Conductas",
    },
  },
};

/**
 * Reglas de asociación diagnóstico → acciones.
 * No se ejecutan solas: solo alimentan la UI de sugerencias.
 */
export const DIAGNOSIS_ASSOCIATION_RULES: DiagnosisAssociationRule[] = [
  {
    id: "hta",
    label: "Hipertensión arterial",
    match: {
      cie10Prefixes: ["I10", "I11", "I12", "I13", "I15"],
      nameIncludes: [
        "hipertension arterial",
        "hipertensión arterial",
        "hta",
        "hypertension",
      ],
    },
    actionIds: [
      "control_pa",
      "antihipertensivo",
      "diuretico",
      "optimizar_hta",
      "dieta_hiposodica",
      "solicitar_laboratorio",
      "ecg",
      "mapa",
      "evaluar_zenith",
      "interconsulta",
    ],
  },
  {
    id: "diabetes",
    label: "Diabetes mellitus",
    match: {
      cie10Prefixes: ["E10", "E11", "E12", "E13", "E14"],
      nameIncludes: ["diabetes", "dm2", "dm1", "dbt"],
    },
    actionIds: [
      "control_glucemia",
      "solicitar_laboratorio",
      "fondo_de_ojo",
      "educacion_diabetes",
      "interconsulta",
    ],
  },
];
