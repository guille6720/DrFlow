import type { ChartAlert, MedicationCard } from "@/features/pacientes/utils/patient-chart-model-types";
import { extractEvolutionDiagnosis } from "@/lib/utils/parse-evolution-medications";
import { buildConsultationDocumentationItems } from "@/lib/utils/consultation-documentation";
import {
  buildMedicationOrderAssistItems,
  buildOrderDraftSuggestion,
} from "@/lib/utils/medication-order-assist";
import type {
  PhysicianAssistContext,
  PhysicianAssistItem,
  PhysicianAssistKind,
} from "@/features/ia/types/physician-assist-types";

function containsAny(hay: string, terms: string[]): boolean {
  const h = hay.toLowerCase();
  return terms.some((t) => h.includes(t));
}

const DRUG_INTERACTION_RULES: Array<{
  groupA: string[];
  groupB: string[];
  message: string;
}> = [
  {
    groupA: ["ibuprofeno", "diclofenac", "ketorolac", "naproxeno", "aas", "aspirina", "piroxicam"],
    groupB: ["warfarina", "acenocumarol", "rivaroxaban", "apixaban", "dabigatran", "heparina"],
    message: "Posible interacción: AINE + anticoagulante (riesgo hemorrágico).",
  },
  {
    groupA: ["enalapril", "losartan", "captopril", "ramipril", "valsartan", "irbesartan"],
    groupB: ["espironolactona", "amilorida", "potasio", "losartan"],
    message: "Posible interacción: IECA/ARA-II con fármacos que retienen potasio.",
  },
  {
    groupA: ["fluoxetina", "sertralina", "paroxetina", "venlafaxina"],
    groupB: ["tramadol", "sumatriptan", "linezolid"],
    message: "Posible interacción: ISRS/IRSN con riesgo de síndrome serotoninérgico.",
  },
  {
    groupA: ["metformina"],
    groupB: ["contraste yodado", "iopamidol"],
    message: "Metformina: evaluar suspensión peri-procedimiento con contraste yodado.",
  },
];

const DUPLICATE_CLASS_RULES: Array<{ terms: string[]; label: string }> = [
  { terms: ["ibuprofeno", "diclofenac", "ketorolac", "naproxeno", "piroxicam"], label: "AINE" },
  { terms: ["enalapril", "losartan", "captopril", "ramipril", "valsartan"], label: "IECA/ARA-II" },
  { terms: ["lorazepam", "diazepam", "clonazepam", "alprazolam"], label: "benzodiacepina" },
];

/** Rule-based medication safety — assistant only, never blocks prescribing. */
export function buildMedicationSafetyWarnings(input: {
  allergies: string[];
  medications: MedicationCard[];
  anticoagulated?: boolean;
  extraMedNames?: string[];
}): string[] {
  const warnings: string[] = [];
  const names = [
    ...input.medications.map((m) => m.name),
    ...(input.extraMedNames ?? []),
  ];
  const blob = names.join(" ").toLowerCase();

  for (const allergy of input.allergies) {
    const a = allergy.toLowerCase();
    if (a.includes("penicil") && blob.match(/amoxicilina|ampicilina|penicilina/)) {
      warnings.push("Posible conflicto: beta-lactámico con alergia a penicilina.");
    }
  }

  const seen = new Set<string>();
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) warnings.push(`Duplicación: ${name}`);
    seen.add(key);
  }

  if (input.anticoagulated && containsAny(blob, ["ibuprofeno", "diclofenac", "aas", "aspirina"])) {
    warnings.push("Paciente anticoagulado con AINE/AAS en medicación — revisar riesgo hemorrágico.");
  }

  for (const rule of DRUG_INTERACTION_RULES) {
    if (containsAny(blob, rule.groupA) && containsAny(blob, rule.groupB)) {
      warnings.push(rule.message);
    }
  }

  for (const cls of DUPLICATE_CLASS_RULES) {
    const hits = cls.terms.filter((t) => blob.includes(t));
    if (hits.length >= 2) {
      warnings.push(`Posible duplicación terapéutica (${cls.label}): ${hits.join(", ")}.`);
    }
  }

  return [...new Set(warnings)];
}

export function extractPathologySearchQuery(input: {
  lastDiagnosis?: string | null;
  lastEvolution?: string | null;
  activeProblems?: string[];
}): string {
  const candidates = [
    input.lastDiagnosis?.trim(),
    extractEvolutionDiagnosis(input.lastEvolution),
    input.activeProblems?.[0]?.trim(),
  ].filter(Boolean) as string[];

  for (const raw of candidates) {
    const cleaned = raw
      .replace(/\bCIE-10\s*:\s*[A-Z0-9.]+\b/gi, "")
      .replace(/\b[A-Z]\d{2}(?:\.\d+)?\b/g, "")
      .replace(/[•\-*]/g, " ")
      .trim();
    if (cleaned.length >= 3) return cleaned.slice(0, 80);
  }
  return "";
}

export function buildClinicalSummary(input: {
  ageLabel: string;
  sex: string;
  insurance: string;
  activeProblems: string[];
  allergies: string[];
  medicationCount: number;
  lastConsultLabel?: string | null;
  alerts: ChartAlert[];
}): string[] {
  const lines: string[] = [];
  lines.push(`${input.ageLabel} · ${input.sex} · ${input.insurance}`);

  if (input.activeProblems.length > 0) {
    lines.push(`Problemas activos: ${input.activeProblems.slice(0, 4).join("; ")}`);
  }
  if (input.allergies.length > 0) {
    lines.push(`Alergias: ${input.allergies.join(", ")}`);
  }
  if (input.medicationCount > 0) {
    lines.push(`Medicación habitual: ${input.medicationCount} fármaco(s) registrado(s)`);
  }
  if (input.lastConsultLabel) {
    lines.push(`Última consulta: ${input.lastConsultLabel}`);
  }

  const red = input.alerts.filter((a) => a.level === "red");
  if (red.length > 0) {
    lines.push(`Alertas críticas: ${red.map((a) => a.label).join(", ")}`);
  }

  return lines;
}

export function buildLightweightPatientWarnings(input: {
  allergies?: string | null;
  regularMedication?: string | null;
  evolutionText?: string;
}): string[] {
  const allergies = (input.allergies ?? "")
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const medNames = [
    ...(input.regularMedication ?? "").split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean),
  ];
  const evolutionMeds = (input.evolutionText ?? "")
    .split(/\n/)
    .filter((l) => /^[\s]*[•\-\*]/.test(l))
    .map((l) => l.replace(/^[\s•\-\*]+/, "").trim())
    .filter(Boolean);

  return buildMedicationSafetyWarnings({
    allergies,
    medications: medNames.map((name, i) => ({
      id: `lite-${i}`,
      name,
      dose: "—",
      frequency: "—",
      sinceLabel: "—",
      lastRenewalLabel: "—",
      raw: { generic_name: name, brand_name: "", presentation: "", concentration: "", quantity: 1, posology: "", route: "oral" },
    })),
    extraMedNames: evolutionMeds,
  });
}

const DIFFERENTIAL_RULES: Array<{ terms: string[]; diagnoses: string[] }> = [
  {
    terms: ["fiebre", "tos", "disnea", "expectoración"],
    diagnoses: ["Neumonía adquirida en la comunidad", "Bronquitis aguda", "COVID-19", "EPOC reagudizado"],
  },
  {
    terms: ["cefalea", "vómitos", "fotofobia", "rigidez"],
    diagnoses: ["Cefalea tensional", "Migraña", "Meningitis", "Hemorragia subaracnoidea"],
  },
  {
    terms: ["dolor torácico", "opresivo", "irradiación", "sudoración"],
    diagnoses: ["Angina inestable", "IAM", "Pericarditis", "Reflujo gastroesofágico"],
  },
  {
    terms: ["dolor abdominal", "náuseas", "vómitos", "fiebre"],
    diagnoses: ["Gastroenteritis aguda", "Apendicitis", "Cólico biliar", "Pancreatitis"],
  },
  {
    terms: ["poliuria", "polidipsia", "pérdida de peso", "glicemia"],
    diagnoses: ["Diabetes mellitus tipo 2", "Diabetes mellitus tipo 1", "Diabetes gestacional"],
  },
  {
    terms: ["hipertensión", "presión", "hta", "elevada"],
    diagnoses: ["Hipertensión arterial esencial", "HTA secundaria", "Crisis hipertensiva"],
  },
  {
    terms: ["dolor lumbar", "lumbalgia", "lumbago", "columna lumbar"],
    diagnoses: ["Lumbalgia mecánica", "Hernia discal lumbar", "Estenosis espinal", "Infección vertebral"],
  },
];

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

/** Structured SOAP draft from chart context — physician must confirm before applying. */
export function buildSoapDraftSuggestion(ctx: PhysicianAssistContext): PhysicianAssistItem | null {
  const evolution = (ctx.evolutionText ?? ctx.lastEvolution ?? "").trim();
  const diagnosis = (ctx.diagnosis ?? ctx.lastDiagnosis ?? extractEvolutionDiagnosis(evolution) ?? "").trim();
  const subjective =
    ctx.chiefComplaint?.trim() ||
    (evolution ? evolution.split("\n")[0]?.trim() : "") ||
    "Paciente refiere motivo de consulta (completar).";
  const objective = ctx.medicalHistory?.trim()
    ? `Antecedentes: ${ctx.medicalHistory.trim().slice(0, 400)}`
    : "Signos vitales y examen físico (completar).";
  const assessment = diagnosis || "Impresión diagnóstica pendiente de confirmación.";
  const planParts = [
    ctx.regularMedication?.trim() ? `Continuar: ${ctx.regularMedication.trim().slice(0, 200)}` : null,
    "Indicaciones y seguimiento (completar).",
  ].filter(Boolean);

  const body = [
    `S (Subjetivo):\n${subjective}`,
    `\nO (Objetivo):\n${objective}`,
    `\nA (Análisis):\n${assessment}`,
    `\nP (Plan):\n${planParts.join("\n")}`,
  ].join("\n");

  if (!evolution && !diagnosis && !ctx.chiefComplaint) return null;

  return {
    id: stableId("soap", body),
    kind: "soap",
    title: "Borrador SOAP",
    body,
  };
}

/** Ranked differential diagnoses from free-text context. */
export function buildDifferentialDiagnosisSuggestions(ctx: PhysicianAssistContext): PhysicianAssistItem[] {
  const blob = textBlob(ctx);
  if (blob.length < 8) return [];

  const matched = new Set<string>();
  for (const rule of DIFFERENTIAL_RULES) {
    if (rule.terms.some((t) => blob.includes(t))) {
      for (const d of rule.diagnoses) matched.add(d);
    }
  }

  if (matched.size === 0 && ctx.lastDiagnosis) {
    matched.add(`Reevaluar: ${ctx.lastDiagnosis}`);
    matched.add("Proceso agudo intercurrente");
    matched.add("Descompensación de comorbilidad crónica");
  }

  if (matched.size === 0) return [];

  const list = [...matched].slice(0, 5).map((d, i) => `${i + 1}. ${d}`).join("\n");
  return [
    {
      id: stableId("differential", list),
      kind: "differential",
      title: "Diagnóstico diferencial sugerido",
      body: `${list}\n\nVerificar con anamnesis, examen físico y estudios complementarios.`,
    },
  ];
}

/** Prescription draft text from habitual meds and diagnosis context. */
export function buildPrescriptionDraftSuggestion(ctx: PhysicianAssistContext): PhysicianAssistItem | null {
  const diagnosis = (ctx.diagnosis ?? ctx.lastDiagnosis ?? "").trim();
  const meds = (ctx.regularMedication ?? "")
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (meds.length === 0 && !diagnosis) return null;

  const lines = [
    diagnosis ? `Diagnóstico: ${diagnosis}` : null,
    meds.length > 0 ? "Medicación sugerida (revisar dosis y vía):" : null,
    ...meds.map((m) => `• ${m}`),
    ctx.proposedMedications?.length
      ? `\nFármacos en formulario:\n${ctx.proposedMedications.map((m) => `• ${m}`).join("\n")}`
      : null,
  ].filter(Boolean);

  return {
    id: stableId("prescription_draft", lines.join("\n")),
    kind: "prescription_draft",
    title: "Borrador de receta",
    body: lines.join("\n"),
  };
}

/** Study/referral order draft — see medication-order-assist (Phase C panels). */
export { buildOrderDraftSuggestion } from "@/lib/utils/medication-order-assist";

/** Discharge summary draft from last encounter context. */
export function buildDischargeSummarySuggestion(ctx: PhysicianAssistContext): PhysicianAssistItem | null {
  const evolution = (ctx.evolutionText ?? ctx.lastEvolution ?? "").trim();
  const diagnosis = (ctx.diagnosis ?? ctx.lastDiagnosis ?? "").trim();
  if (!evolution && !diagnosis) return null;

  const patient = ctx.patientName ?? "Paciente";
  const body = [
    `RESUMEN DE ALTA — ${patient}`,
    "",
    `Diagnóstico principal: ${diagnosis || "—"}`,
    "",
    "Evolución durante la internación/consulta:",
    evolution.slice(0, 600) || "—",
    "",
    "Plan al alta:",
    "• Medicación: " + (ctx.regularMedication?.trim().slice(0, 200) || "completar"),
    "• Controles: completar según protocolo",
    "• Signos de alarma: consultar ante empeoramiento",
  ].join("\n");

  return {
    id: stableId("discharge_summary", body),
    kind: "discharge_summary",
    title: "Resumen de alta",
    body,
  };
}

/** Medical certificate draft (reposo / aptitud). */
export function buildMedicalCertificateDraft(ctx: PhysicianAssistContext): PhysicianAssistItem | null {
  const diagnosis = (ctx.diagnosis ?? ctx.lastDiagnosis ?? extractEvolutionDiagnosis(ctx.evolutionText) ?? "").trim();
  if (!diagnosis && !ctx.evolutionText?.trim()) return null;

  const patient = ctx.patientName ?? "________________";
  const body = [
    "CERTIFICADO MÉDICO",
    "",
    `Certifico que ${patient} fue atendido/a en consulta y presenta:`,
    diagnosis || "(diagnóstico a completar)",
    "",
    "Se indica reposo / tratamiento / aptitud física: _______________ días / situación.",
    "",
    "Observaciones:",
    (ctx.evolutionText ?? ctx.lastEvolution ?? "").slice(0, 300) || "—",
    "",
    "Este certificado requiere revisión, firma y sello del profesional tratante.",
  ].join("\n");

  return {
    id: stableId("medical_certificate", body),
    kind: "medical_certificate",
    title: "Borrador de certificado médico",
    body,
  };
}

/** Interaction alerts as confirmable assist items. */
export function buildInteractionAlertItems(ctx: PhysicianAssistContext): PhysicianAssistItem[] {
  const warnings = buildLightweightPatientWarnings({
    allergies: ctx.allergies,
    regularMedication: ctx.regularMedication,
    evolutionText: ctx.evolutionText ?? ctx.lastEvolution ?? undefined,
  });

  const extra = ctx.proposedMedications?.length
    ? buildMedicationSafetyWarnings({
        allergies: (ctx.allergies ?? "")
          .split(/[\n,;]+/)
          .map((s) => s.trim())
          .filter(Boolean),
        medications: ctx.proposedMedications.map((name, i) => ({
          id: `rx-${i}`,
          name,
          dose: "—",
          frequency: "—",
          sinceLabel: "—",
          lastRenewalLabel: "—",
          raw: {} as never,
        })),
        extraMedNames: (ctx.regularMedication ?? "")
          .split(/[\n,;]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      })
    : [];

  return [...new Set([...warnings, ...extra])].map((w) => ({
    id: stableId("interaction_alert", w),
    kind: "interaction_alert" as const,
    title: "Alerta medicamentosa",
    body: w,
  }));
}

/** Clinical summary as a single assist item for resumen tab. */
export function buildClinicalSummaryAssistItem(input: {
  ageLabel: string;
  sex: string;
  insurance: string;
  activeProblems: string[];
  allergies: string[];
  medicationCount: number;
  lastConsultLabel?: string | null;
  alerts: ChartAlert[];
}): PhysicianAssistItem {
  const lines = buildClinicalSummary(input);
  return {
    id: stableId("clinical_summary", lines.join("|")),
    kind: "clinical_summary",
    title: "Resumen clínico",
    body: lines.join("\n"),
  };
}

/** Generate assist items for a workflow, filtered by kind. */
export function buildPhysicianAssistItems(
  ctx: PhysicianAssistContext,
  kinds: PhysicianAssistKind[]
): PhysicianAssistItem[] {
  const kindSet = new Set(kinds);
  const items: PhysicianAssistItem[] = [];

  if (kindSet.has("interaction_alert")) {
    items.push(...buildInteractionAlertItems(ctx));
  }
  items.push(...buildConsultationDocumentationItems(ctx, kinds));
  items.push(...buildMedicationOrderAssistItems(ctx, kinds));

  if (kindSet.has("soap")) {
    const soap = buildSoapDraftSuggestion(ctx);
    if (soap) items.push(soap);
  }
  if (kindSet.has("clinical_summary")) {
    items.push(
      buildClinicalSummaryAssistItem({
        ageLabel: ctx.ageLabel ?? "—",
        sex: ctx.sex ?? "—",
        insurance: ctx.insurance ?? "—",
        activeProblems: ctx.activeProblems ?? [],
        allergies: (ctx.allergies ?? "")
          .split(/[\n,;]+/)
          .map((s) => s.trim())
          .filter(Boolean),
        medicationCount: (ctx.regularMedication ?? "")
          .split(/[\n,;]+/)
          .filter((s) => s.trim()).length,
        alerts: [],
      })
    );
  }
  if (kindSet.has("differential")) {
    items.push(...buildDifferentialDiagnosisSuggestions(ctx));
  }
  if (kindSet.has("prescription_draft")) {
    const rx = buildPrescriptionDraftSuggestion(ctx);
    if (rx) items.push(rx);
  }
  if (kindSet.has("order_draft")) {
    const order = buildOrderDraftSuggestion(ctx);
    if (order) items.push(order);
  }
  if (kindSet.has("discharge_summary")) {
    const discharge = buildDischargeSummarySuggestion(ctx);
    if (discharge) items.push(discharge);
  }
  if (kindSet.has("medical_certificate")) {
    const cert = buildMedicalCertificateDraft(ctx);
    if (cert) items.push(cert);
  }

  return items;
}
