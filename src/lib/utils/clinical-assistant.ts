import type { ChartAlert, MedicationCard } from "@/lib/utils/patient-chart-types";
import { extractEvolutionDiagnosis } from "@/lib/utils/parse-evolution-medications";

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
