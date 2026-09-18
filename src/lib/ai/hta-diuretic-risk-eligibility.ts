/**
 * Elegibilidad determinística para screening HTA:
 * ≥2 antihipertensivos (incluye ≥1 diurético) + ≥2 factores de riesgo.
 * Orden: primero quienes tienen todos los factores.
 */

import type { PatientChartExtras } from "@/features/pacientes/utils/patient-chart-model-types";

import { foldMedicalText } from "@/lib/ai/gemini-medical-lexicon";
import { calculateBmi, estimateTfgCkdEpi } from "@/lib/utils/clinical-indicators";

export const HTA_DIURETIC_RISK_FACTOR_IDS = [
  "age_over_70",
  "smoker",
  "atrial_fibrillation",
  "diabetes",
  "bmi_ge_30",
  "gfr_lt_60",
] as const;

export type HtaDiureticRiskFactorId = (typeof HTA_DIURETIC_RISK_FACTOR_IDS)[number];

export const HTA_DIURETIC_RISK_FACTOR_LABELS: Record<HtaDiureticRiskFactorId, string> = {
  age_over_70: "edad > 70",
  smoker: "tabaquista",
  atrial_fibrillation: "fibrilación auricular",
  diabetes: "diabetes",
  bmi_ge_30: "IMC ≥ 30",
  gfr_lt_60: "filtrado glomerular < 60",
};

/** Clases antihipertensivas (no diuréticas) — cada clase cuenta como 1 fármaco. */
export const ANTIHYPERTENSIVE_CLASSES: Array<{ id: string; needles: string[] }> = [
  {
    id: "ieca",
    needles: [
      "ieca",
      "inhibidor eca",
      "enalapril",
      "ramipril",
      "perindopril",
      "lisinopril",
      "captopril",
      "fosinopril",
    ],
  },
  {
    id: "ara2",
    needles: [
      "ara ii",
      "ara 2",
      "ara2",
      "arb",
      "losartan",
      "valsartan",
      "telmisartan",
      "candesartan",
      "irbesartan",
      "olmesartan",
    ],
  },
  {
    id: "ccb",
    needles: [
      "calcioantagonista",
      "bloqueante calcio",
      "amlodipina",
      "amlodipino",
      "nifedipina",
      "lercanidipina",
      "diltiazem",
      "verapamilo",
    ],
  },
  {
    id: "bb",
    needles: [
      "betabloqueante",
      "beta bloqueante",
      "bisoprolol",
      "atenolol",
      "carvedilol",
      "nebivolol",
      "metoprolol",
      "propranolol",
    ],
  },
  {
    id: "other_aht",
    needles: [
      "antihipertens",
      "doxazosina",
      "prazosina",
      "clonidina",
      "metildopa",
      "moxonidina",
      "aliskiren",
      "hidralazina",
    ],
  },
];

/** Diuréticos (cuentan como antihipertensivo + cumplen el requisito de diurético). */
export const DIURETIC_NEEDLES = [
  "diuretico",
  "tiazida",
  "hidroclorotiazida",
  "hctz",
  "indapamida",
  "clortalidona",
  "furosemida",
  "bumetanida",
  "torasemida",
  "espironolactona",
  "eplerenona",
  "amilorida",
  "anti aldosterona",
  "antagonista de aldosterona",
];

export type HtaDiureticRiskInput = {
  birthDate?: string | null;
  sex?: string | null;
  regularMedication?: string | null;
  medicalHistory?: string | null;
  hcBlob?: string | null;
  treatmentsText?: string | null;
  chartExtras?: PatientChartExtras | null;
  /** Fecha de referencia para edad (default: ahora). */
  now?: Date;
};

export type HtaDiureticRiskScore = {
  passesGate: boolean;
  antihypertensiveClassCount: number;
  hasDiuretic: boolean;
  detectedClasses: string[];
  factors: HtaDiureticRiskFactorId[];
  factorCount: number;
  /** true si tiene los 6 factores. */
  hasAllFactors: boolean;
  /** Elegible: gate + ≥2 factores. */
  eligible: boolean;
  /** Prioridad de ordenamiento: factorCount (6 primero), luego # antihipertensivos. */
  rankScore: number;
  summaryLabel: string;
};

function fold(value: string | null | undefined): string {
  return foldMedicalText(value ?? "");
}

function ageFromBirthDate(birthDate: string | null | undefined, now: Date): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

function normalizeSex(sex: string | null | undefined): "M" | "F" | null {
  const s = fold(sex);
  if (!s) return null;
  if (s.startsWith("f") || s === "mujer" || s === "female") return "F";
  if (s.startsWith("m") || s === "hombre" || s === "male" || s === "varon") return "M";
  return null;
}

function blobHasAny(foldedBlob: string, needles: string[]): boolean {
  const padded = ` ${foldedBlob} `;
  return needles.some((n) => {
    const needle = fold(n).trim();
    return needle.length >= 2 && padded.includes(needle);
  });
}

function countAntihypertensiveClasses(foldedMeds: string): {
  classes: string[];
  hasDiuretic: boolean;
} {
  const classes: string[] = [];
  for (const cls of ANTIHYPERTENSIVE_CLASSES) {
    if (blobHasAny(foldedMeds, cls.needles)) {
      classes.push(cls.id);
    }
  }
  const hasDiuretic = blobHasAny(foldedMeds, DIURETIC_NEEDLES);
  return { classes, hasDiuretic };
}

function extractBmi(input: HtaDiureticRiskInput, foldedBlob: string): number | null {
  const extras = input.chartExtras;
  if (extras?.weight_kg && extras?.height_cm) {
    const bmi = calculateBmi(extras.weight_kg, extras.height_cm);
    if (bmi != null) return bmi;
  }

  const imcMatch = foldedBlob.match(/\bimc\s*[:=]?\s*(\d{2}(?:[.,]\d+)?)/i);
  if (imcMatch) {
    const n = parseFloat(imcMatch[1].replace(",", "."));
    if (Number.isFinite(n) && n > 10 && n < 80) return n;
  }

  const weight = foldedBlob.match(/\bpeso\s*[:=]?\s*(\d{2,3}(?:[.,]\d+)?)\s*kg/);
  const height = foldedBlob.match(/\b(?:talla|altura)\s*[:=]?\s*(\d{2,3}(?:[.,]\d+)?)\s*cm/);
  if (weight && height) {
    return calculateBmi(
      parseFloat(weight[1].replace(",", ".")),
      parseFloat(height[1].replace(",", "."))
    );
  }
  return null;
}

function extractGfr(input: HtaDiureticRiskInput, foldedBlob: string, ageYears: number | null): number | null {
  const direct = foldedBlob.match(
    /\b(?:tfg|egfr|filtrado(?:\s+glomerular)?|fg)\s*[:=]?\s*(\d{1,3}(?:[.,]\d+)?)/i
  );
  if (direct) {
    const n = parseFloat(direct[1].replace(",", "."));
    if (Number.isFinite(n) && n > 0 && n < 200) return n;
  }

  const extras = input.chartExtras;
  const creatLab = extras?.labs?.find((l) => fold(l.name).includes("creatinina"));
  const creatFromLab = creatLab?.value
    ? parseFloat(String(creatLab.value).replace(",", "."))
    : null;
  const creatFromText = foldedBlob.match(/\bcreatinina\s*[:=]?\s*(\d+(?:[.,]\d+)?)/);
  const creatinine =
    creatFromLab != null && Number.isFinite(creatFromLab)
      ? creatFromLab
      : creatFromText
        ? parseFloat(creatFromText[1].replace(",", "."))
        : null;

  if (ageYears != null && creatinine != null && creatinine > 0) {
    return estimateTfgCkdEpi({
      ageYears,
      creatinineMgDl: creatinine,
      sex: normalizeSex(input.sex ?? extras?.sex),
    });
  }

  if (extras?.renal_failure) return 45; // señal de ERC sin número → tratar como < 60
  return null;
}

function detectSmoker(input: HtaDiureticRiskInput, foldedBlob: string): boolean {
  if (input.chartExtras?.smoker === "active") return true;
  if (input.chartExtras?.smoker === "former" || input.chartExtras?.smoker === "never") return false;
  return blobHasAny(foldedBlob, [
    "tabaquista",
    "tabaquismo activo",
    "fumador activo",
    "fuma ",
    " fuma",
    "tabaco activo",
    "cigarrillo",
    "cigarrillos",
  ]);
}

function detectAf(foldedBlob: string): boolean {
  return blobHasAny(foldedBlob, [
    "fibrilacion auricular",
    "fibrilación auricular",
    "fibrilacion atrial",
    " fa ",
    "fa,",
    "fa.",
    "fa;",
    "fa/",
    "i48",
    "flutter auricular",
  ]);
}

function detectDiabetes(foldedBlob: string): boolean {
  return blobHasAny(foldedBlob, [
    "diabetes",
    "dbt",
    "dm2",
    "dm1",
    "dm tipo",
    "e10",
    "e11",
    "e14",
    "hba1c",
  ]);
}

export function scoreHtaDiureticRisk(input: HtaDiureticRiskInput): HtaDiureticRiskScore {
  const now = input.now ?? new Date();
  const ageYears = ageFromBirthDate(input.birthDate, now);
  const medsBlob = fold(
    [input.regularMedication, input.treatmentsText, input.hcBlob, input.medicalHistory]
      .filter(Boolean)
      .join(" ")
  );
  const clinicalBlob = fold(
    [input.hcBlob, input.medicalHistory, input.regularMedication].filter(Boolean).join(" ")
  );

  const { classes, hasDiuretic } = countAntihypertensiveClasses(medsBlob);
  const antihypertensiveClassCount = classes.length + (hasDiuretic ? 1 : 0);
  const passesGate = antihypertensiveClassCount >= 2 && hasDiuretic;

  const factors: HtaDiureticRiskFactorId[] = [];

  if (ageYears != null && ageYears > 70) {
    factors.push("age_over_70");
  }

  if (detectSmoker(input, clinicalBlob)) {
    factors.push("smoker");
  }

  if (detectAf(clinicalBlob)) {
    factors.push("atrial_fibrillation");
  }

  if (detectDiabetes(clinicalBlob)) {
    factors.push("diabetes");
  }

  const bmi = extractBmi(input, clinicalBlob);
  if (bmi != null && bmi >= 30) {
    factors.push("bmi_ge_30");
  } else if (blobHasAny(clinicalBlob, ["obesidad", "obeso", "obesa"])) {
    factors.push("bmi_ge_30");
  }

  const gfr = extractGfr(input, clinicalBlob, ageYears);
  if (gfr != null && gfr < 60) {
    factors.push("gfr_lt_60");
  } else if (
    blobHasAny(clinicalBlob, ["erc ", " irc ", "insuficiencia renal", "enfermedad renal cronica"])
  ) {
    factors.push("gfr_lt_60");
  }

  const factorCount = factors.length;
  const hasAllFactors = factorCount === HTA_DIURETIC_RISK_FACTOR_IDS.length;
  const eligible = passesGate && factorCount >= 2;
  const rankScore = eligible ? factorCount * 100 + antihypertensiveClassCount : 0;

  const factorLabels = factors.map((id) => HTA_DIURETIC_RISK_FACTOR_LABELS[id]);
  const summaryLabel = eligible
    ? `HTA ≥2 AHT+diurético · ${factorCount}/6 factores${hasAllFactors ? " (todos)" : ""}: ${factorLabels.join(", ")}`
    : !passesGate
      ? `No cumple gate (≥2 AHT con diurético): ${antihypertensiveClassCount} clases, diurético=${hasDiuretic ? "sí" : "no"}`
      : `Gate OK pero solo ${factorCount} factor(es) de riesgo (<2)`;

  return {
    passesGate,
    antihypertensiveClassCount,
    hasDiuretic,
    detectedClasses: hasDiuretic ? [...classes, "diuretic"] : classes,
    factors,
    factorCount,
    hasAllFactors,
    eligible,
    rankScore,
    summaryLabel,
  };
}

/** Orden: todos los factores primero, luego más factores, luego más antihipertensivos. */
export function compareHtaDiureticRiskScores(a: HtaDiureticRiskScore, b: HtaDiureticRiskScore): number {
  if (a.hasAllFactors !== b.hasAllFactors) return a.hasAllFactors ? -1 : 1;
  if (b.factorCount !== a.factorCount) return b.factorCount - a.factorCount;
  if (b.antihypertensiveClassCount !== a.antihypertensiveClassCount) {
    return b.antihypertensiveClassCount - a.antihypertensiveClassCount;
  }
  return 0;
}

/** Detecta si el mensaje pide este perfil multi-factor (además de ZENITH). */
export function messageWantsHtaDiureticRiskScreening(foldedMessage: string): boolean {
  const hasMeds =
    /antihipertens|2\s+anti|dos\s+anti|diuretico|diur[eé]tico/.test(foldedMessage);
  const hasFactors =
    /(edad|mayor(es)?\s+(de|a)\s*70|tabaquist|fumador|fibrilacion| fa\b|diabetes|imc|obesidad|filtrado|tfg|egfr|factor(es)?\s+de\s+riesgo)/.test(
      foldedMessage
    );
  const hasListIntent = /pacientes?|candidat|listad|buscar|screening|perfil|deriv/.test(foldedMessage);
  return (hasMeds && hasFactors) || (hasMeds && hasListIntent && /diuretico|diur[eé]tico/.test(foldedMessage));
}
