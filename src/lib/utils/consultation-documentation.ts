import type { PhysicianAssistContext, PhysicianAssistItem, PhysicianAssistKind } from "@/features/ia/types/physician-assist-types";

function containsAny(hay: string, terms: string[]): boolean {
  const h = hay.toLowerCase();
  return terms.some((t) => h.includes(t));
}

function textBlob(ctx: PhysicianAssistContext): string {
  return [
    ctx.evolutionText,
    ctx.diagnosis,
    ctx.chiefComplaint,
    ctx.lastEvolution,
    ctx.lastDiagnosis,
    ...(ctx.activeProblems ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function stableId(kind: PhysicianAssistKind, seed: string): string {
  return `${kind}-${seed.slice(0, 48).replace(/\s+/g, "-")}`;
}

const PHYSICAL_EXAM_RULES: Array<{ terms: string[]; sections: string[] }> = [
  {
    terms: ["dolor lumbar", "lumbalgia", "lumbago", "columna lumbar"],
    sections: [
      "Inspección: postura, marcha, deformidades.",
      "Palpación: apófisis espinosas lumbares, musculatura paravertebral.",
      "Maniobras: Lasègue bilateral, fuerza/sensibilidad en miembros inferiores.",
      "Signos de alarma: déficit motor, anestesia en silla de montar, fiebre, trauma.",
    ],
  },
  {
    terms: ["fiebre", "tos", "disnea", "expectoración"],
    sections: [
      "Signos vitales: temperatura, FC, FR, SatO₂, PA.",
      "Tórax: inspección, percusión, auscultación pulmonar.",
      "Cuello: adenopatías, ingurgitación yugular.",
      "Evaluar trabajo respiratorio y cianosis.",
    ],
  },
  {
    terms: ["cefalea", "vómitos", "fotofobia", "rigidez"],
    sections: [
      "Signos vitales y temperatura.",
      "Neurológico: nivel de conciencia, pares craneales, fuerza, sensibilidad.",
      "Rigidez de nuca / Kernig / Brudzinski si indicado.",
      "Fondo de ojo si hipertensión intracraneal sospechada.",
    ],
  },
  {
    terms: ["dolor torácico", "opresivo", "irradiación", "sudoración"],
    sections: [
      "Signos vitales incluyendo PA bilateral y SatO₂.",
      "Cardiovascular: ritmo, soplos, ingurgitación yugular, edemas.",
      "Pulmonar: auscultación.",
      "ECG en reposo si disponible.",
    ],
  },
  {
    terms: ["dolor abdominal", "náuseas", "vómitos"],
    sections: [
      "Signos vitales y estado de hidratación.",
      "Abdomen: inspección, auscultación, palpación superficial/profunda, defensa, rebote.",
      "Evaluar Murphy, Blumberg, Rovsing según cuadro.",
      "Tacto rectal si indicado.",
    ],
  },
  {
    terms: ["poliuria", "polidipsia", "glicemia", "diabetes"],
    sections: [
      "Signos vitales y peso/IMC.",
      "Piel: acantosis nigricans, lesiones de infección.",
      "Extremidades: pulsos pedios, sensibilidad, úlceras.",
      "Fondo de ojo si control diabético.",
    ],
  },
  {
    terms: ["hipertensión", "presión", "hta"],
    sections: [
      "PA en ambos brazos (protocolo HTA).",
      "Cardiovascular: ritmo, soplos, ingurgitación yugular.",
      "Pulmonar: crepitantes (ICC).",
      "Edemas periféricos.",
    ],
  },
];

const THERAPEUTIC_PLAN_RULES: Array<{ terms: string[]; plan: string[] }> = [
  {
    terms: ["dolor lumbar", "lumbalgia", "lumbago"],
    plan: [
      "Analgesia según intensidad (AINE si no contraindicado).",
      "Medidas no farmacológicas: reposo relativo, calor local, higiene postural.",
      "Estudios si persistencia >6 semanas o signos de alarma: RX columna, RM si indicado.",
      "Control en 7–14 días o antes si empeora.",
    ],
  },
  {
    terms: ["fiebre", "tos", "disnea", "neumonía"],
    plan: [
      "Antibiótico empírico según guía local si infección bacteriana probable.",
      "Antipiréticos/analgésicos según síntomas.",
      "Hidratación y control de signos vitales.",
      "Control radiológico/clínico según evolución.",
    ],
  },
  {
    terms: ["cefalea"],
    plan: [
      "Analgésico de primera línea según perfil del paciente.",
      "Identificar desencadenantes y signos de alarma.",
      "Estudios de imagen si cefalea thunderclap, focalidad neurológica o cambio de patrón.",
      "Seguimiento según respuesta.",
    ],
  },
  {
    terms: ["diabetes", "glicemia", "hba1c"],
    plan: [
      "Reforzar dieta y actividad física.",
      "Ajuste de hipoglucemiantes según metas individuales.",
      "Solicitar HbA1c, glucemia en ayunas, perfil lipídico, creatinina.",
      "Control oftalmológico y evaluación de pie diabético según protocolo.",
    ],
  },
  {
    terms: ["hipertensión", "hta", "presión"],
    plan: [
      "Medidas higiénico-dietéticas: sodio, peso, actividad física.",
      "Ajuste/optimización de antihipertensivos según comorbilidades.",
      "Monitoreo domiciliario de PA si disponible.",
      "Laboratorio: creatinina, ionograma, perfil lipídico según control.",
    ],
  },
];

/** Common CIE-10 codes for rule-based differential diagnoses. */
export const CIE10_BY_DIAGNOSIS: Record<string, string> = {
  "Neumonía adquirida en la comunidad": "J18.9",
  "Bronquitis aguda": "J20.9",
  "COVID-19": "U07.1",
  "EPOC reagudizado": "J44.1",
  "Cefalea tensional": "G44.2",
  Migraña: "G43.9",
  Meningitis: "G03.9",
  "Hemorragia subaracnoidea": "I60.9",
  "Angina inestable": "I20.0",
  IAM: "I21.9",
  Pericarditis: "I30.9",
  "Reflujo gastroesofágico": "K21.9",
  "Gastroenteritis aguda": "A09",
  Apendicitis: "K35.8",
  "Cólico biliar": "K80.5",
  Pancreatitis: "K85.9",
  "Diabetes mellitus tipo 2": "E11.9",
  "Diabetes mellitus tipo 1": "E10.9",
  "Diabetes gestacional": "O24.4",
  "Hipertensión arterial esencial": "I10",
  "HTA secundaria": "I15.9",
  "Crisis hipertensiva": "I16.9",
  "Lumbalgia mecánica": "M54.5",
  "Hernia discal lumbar": "M51.2",
  "Estenosis espinal": "M48.0",
  "Infección vertebral": "M46.9",
};

export type Cie10Suggestion = {
  diagnosis: string;
  code: string;
  source: "rule" | "differential";
};

function parseComplaintBullets(text: string): string[] {
  const lower = text.toLowerCase();
  const bullets: string[] = [];

  const durationMatch = lower.match(/hace\s+(\d+\s*(?:días?|semanas?|meses?|años?))/);
  if (durationMatch) bullets.push(`Inicio: ${durationMatch[1]}`);

  if (containsAny(lower, ["sin irradiación", "no irradiación", "sin irradiacion"])) {
    bullets.push("Sin irradiación referida.");
  }
  if (containsAny(lower, ["no fiebre", "sin fiebre", "afebril"])) {
    bullets.push("Niega fiebre.");
  }
  if (containsAny(lower, ["con fiebre", "fiebre"])) {
    bullets.push("Refiere fiebre (caracterizar).");
  }

  return bullets;
}

/** Structured evolution draft from free-text complaint or dictation. */
export function buildEvolutionDraftSuggestion(ctx: PhysicianAssistContext): PhysicianAssistItem | null {
  const raw = (ctx.evolutionText ?? ctx.chiefComplaint ?? "").trim();
  if (raw.length < 12) return null;

  const firstLine = raw.split("\n")[0]?.trim() ?? raw;
  const bullets = parseComplaintBullets(firstLine);
  const historyNote = ctx.medicalHistory?.trim()
    ? `Antecedentes: ${ctx.medicalHistory.trim().slice(0, 300)}`
    : "Antecedentes relevantes: (completar).";

  const body = [
    `Motivo de consulta: ${firstLine}`,
    "",
    "Evolución:",
    bullets.length > 0 ? bullets.map((b) => `• ${b}`).join("\n") : `• ${firstLine}`,
    `• ${historyNote}`,
    "",
    "Examen físico: (completar según hallazgos).",
    "Impresión diagnóstica: (completar).",
    "Plan: (completar).",
  ].join("\n");

  return {
    id: stableId("evolution_draft", body),
    kind: "evolution_draft",
    title: "Borrador de evolución",
    body,
  };
}

/** Physical exam checklist from symptom keywords. */
export function buildPhysicalExamSuggestion(ctx: PhysicianAssistContext): PhysicianAssistItem | null {
  const blob = textBlob(ctx);
  if (blob.length < 8) return null;

  const sections = new Set<string>();
  for (const rule of PHYSICAL_EXAM_RULES) {
    if (rule.terms.some((t) => blob.includes(t))) {
      for (const s of rule.sections) sections.add(s);
    }
  }

  if (sections.size === 0) {
    return {
      id: stableId("physical_exam", blob),
      kind: "physical_exam",
      title: "Examen físico sugerido",
      body: [
        "Examen físico general sugerido:",
        "• Signos vitales completos.",
        "• Examen por aparatos según motivo de consulta.",
        "• Buscar signos de alarma y red flags.",
      ].join("\n"),
    };
  }

  const body = ["Examen físico sugerido:", ...[...sections].map((s) => `• ${s}`)].join("\n");
  return {
    id: stableId("physical_exam", body),
    kind: "physical_exam",
    title: "Examen físico sugerido",
    body,
  };
}

/** Therapeutic plan draft from clinical context. */
export function buildTherapeuticPlanSuggestion(ctx: PhysicianAssistContext): PhysicianAssistItem | null {
  const blob = textBlob(ctx);
  if (blob.length < 8) return null;

  const plan = new Set<string>();
  for (const rule of THERAPEUTIC_PLAN_RULES) {
    if (rule.terms.some((t) => blob.includes(t))) {
      for (const p of rule.plan) plan.add(p);
    }
  }

  if (ctx.regularMedication?.trim()) {
    plan.add(`Continuar medicación habitual: ${ctx.regularMedication.trim().slice(0, 180)}.`);
  }

  if (plan.size === 0) {
    return {
      id: stableId("therapeutic_plan", blob),
      kind: "therapeutic_plan",
      title: "Plan terapéutico sugerido",
      body: [
        "Plan terapéutico sugerido (revisar):",
        "• Tratamiento sintomático según cuadro.",
        "• Estudios complementarios según criterio clínico.",
        "• Seguimiento y signos de alarma para reconsulta.",
      ].join("\n"),
    };
  }

  const body = [
    "Plan terapéutico sugerido (revisar):",
    ...[...plan].slice(0, 6).map((p) => `• ${p}`),
  ].join("\n");

  return {
    id: stableId("therapeutic_plan", body),
    kind: "therapeutic_plan",
    title: "Plan terapéutico sugerido",
    body,
  };
}

/** Extract CIE-10 suggestions from differential diagnosis lines in assist items. */
export function extractCie10FromDifferentialBody(body: string): Cie10Suggestion[] {
  const suggestions: Cie10Suggestion[] = [];
  const lines = body.split("\n");

  for (const line of lines) {
    const cleaned = line.replace(/^\d+\.\s*/, "").trim();
    if (!cleaned || cleaned.startsWith("Verificar")) continue;

    const directCode = CIE10_BY_DIAGNOSIS[cleaned];
    if (directCode) {
      suggestions.push({ diagnosis: cleaned, code: directCode, source: "differential" });
      continue;
    }

    for (const [diagnosis, code] of Object.entries(CIE10_BY_DIAGNOSIS)) {
      if (cleaned.toLowerCase().includes(diagnosis.toLowerCase().slice(0, 12))) {
        suggestions.push({ diagnosis, code, source: "differential" });
        break;
      }
    }
  }

  const seen = new Set<string>();
  return suggestions.filter((s) => {
    const key = s.code;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Symptom-level CIE-10 mapping when diagnosis label tokens do not appear in free text. */
const CIE10_SYMPTOM_RULES: Array<{ terms: string[]; diagnosis: string; code: string }> = [
  { terms: ["dolor lumbar", "lumbalgia", "lumbago"], diagnosis: "Lumbalgia mecánica", code: "M54.5" },
  { terms: ["fiebre", "tos", "disnea"], diagnosis: "Neumonía adquirida en la comunidad", code: "J18.9" },
  { terms: ["cefalea"], diagnosis: "Cefalea tensional", code: "G44.2" },
  { terms: ["dolor torácico", "opresivo"], diagnosis: "Angina inestable", code: "I20.0" },
  { terms: ["dolor abdominal"], diagnosis: "Gastroenteritis aguda", code: "A09" },
  { terms: ["diabetes", "glicemia", "hba1c"], diagnosis: "Diabetes mellitus tipo 2", code: "E11.9" },
  { terms: ["hipertensión", "hta", "presión"], diagnosis: "Hipertensión arterial esencial", code: "I10" },
];

/** Rule-based CIE-10 suggestions from evolution/diagnosis text. */
export function buildCie10Suggestions(ctx: PhysicianAssistContext): Cie10Suggestion[] {
  const blob = textBlob(ctx);
  const suggestions: Cie10Suggestion[] = [];

  for (const rule of CIE10_SYMPTOM_RULES) {
    if (rule.terms.some((t) => blob.includes(t))) {
      suggestions.push({ diagnosis: rule.diagnosis, code: rule.code, source: "rule" });
    }
  }

  for (const [diagnosis, code] of Object.entries(CIE10_BY_DIAGNOSIS)) {
    const tokens = diagnosis.toLowerCase().split(/\s+/).filter((t) => t.length >= 5);
    if (tokens.some((t) => blob.includes(t))) {
      suggestions.push({ diagnosis, code, source: "rule" });
    }
  }

  const diagnosis = (ctx.diagnosis ?? ctx.lastDiagnosis ?? "").trim();
  if (diagnosis) {
    const code = CIE10_BY_DIAGNOSIS[diagnosis];
    if (code) suggestions.push({ diagnosis, code, source: "rule" });
  }

  const seen = new Set<string>();
  return suggestions.filter((s) => {
    if (seen.has(s.code)) return false;
    seen.add(s.code);
    return true;
  }).slice(0, 5);
}

/** CIE-10 as confirmable assist item. */
export function buildCie10SuggestionItem(ctx: PhysicianAssistContext): PhysicianAssistItem | null {
  const suggestions = buildCie10Suggestions(ctx);
  if (suggestions.length === 0) return null;

  const body = [
    ...suggestions.map((s) => `• ${s.diagnosis} — CIE-10: ${s.code}`),
    "",
    "Referencia para codificación — confirmar con criterio clínico.",
  ].join("\n");

  return {
    id: stableId("cie10_suggestion", body),
    kind: "cie10_suggestion",
    title: "CIE-10 sugerido",
    body,
  };
}

/** Documentation agent items for consultation workflow (Phase B). */
export function buildConsultationDocumentationItems(
  ctx: PhysicianAssistContext,
  kinds: PhysicianAssistKind[]
): PhysicianAssistItem[] {
  const kindSet = new Set(kinds);
  const items: PhysicianAssistItem[] = [];

  if (kindSet.has("evolution_draft")) {
    const evolution = buildEvolutionDraftSuggestion(ctx);
    if (evolution) items.push(evolution);
  }
  if (kindSet.has("physical_exam")) {
    const exam = buildPhysicalExamSuggestion(ctx);
    if (exam) items.push(exam);
  }
  if (kindSet.has("therapeutic_plan")) {
    const plan = buildTherapeuticPlanSuggestion(ctx);
    if (plan) items.push(plan);
  }
  if (kindSet.has("cie10_suggestion")) {
    const cie10 = buildCie10SuggestionItem(ctx);
    if (cie10) items.push(cie10);
  }

  return items;
}
