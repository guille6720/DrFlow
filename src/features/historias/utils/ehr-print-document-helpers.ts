import {
  parseDiagnosisLine,
  parseInlineDiagnoses,
  splitTreatmentProductLab,
} from "@/features/historias/components/historias/patient-ehr-print-utils";
import type {
  PatientEhrConsultation,
  PatientEhrDiagnosisRow,
  PatientEhrTreatmentRow,
} from "@/features/pacientes/utils/patient-ehr-model";

export type PrintVitalsMap = Record<string, string>;

const VITAL_ALIASES: Array<{ key: string; labels: string[] }> = [
  { key: "TA", labels: ["ta", "tension", "tensión", "pas/pad", "pa"] },
  { key: "FC", labels: ["fc", "frecuencia cardiaca", "frecuencia cardíaca", "pulso"] },
  { key: "FR", labels: ["fr", "frecuencia respiratoria"] },
  { key: "Temp", labels: ["temp", "temperatura", "t°", "tº"] },
  { key: "SatO₂", labels: ["sato2", "sat o2", "sat. o2", "spo2", "sat"] },
  { key: "Peso", labels: ["peso", "weight"] },
  { key: "Talla", labels: ["talla", "altura", "height"] },
  { key: "IMC", labels: ["imc", "bmi"] },
];

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9%/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchVitalLabel(rawLabel: string): string | null {
  const normalized = normalizeKey(rawLabel);
  for (const entry of VITAL_ALIASES) {
    if (entry.labels.some((label) => normalized === label || normalized.startsWith(`${label} `))) {
      return entry.key;
    }
  }
  return null;
}

/** Extrae signos vitales desde texto libre sin inventar valores. */
export function parseVitalsFromText(text: string | null | undefined): PrintVitalsMap {
  const raw = text?.trim();
  if (!raw) return {};

  const blockMatch = raw.match(/signos?\s+vitales?\s*[:\-]?\s*([\s\S]+)/i);
  const source = blockMatch?.[1] ?? raw;
  const result: PrintVitalsMap = {};

  const pairRegex =
    /(TA|Tensión(?:\s+arterial)?|FC|FR|Temp(?:eratura)?|T[°º]|Sat(?:\.?\s*O?₂?|O2)|SpO2|Peso|Talla|IMC)\s*[:=\-]?\s*([0-9]+(?:[.,][0-9]+)?(?:\s*\/\s*[0-9]+(?:[.,][0-9]+)?)?(?:\s*(?:mmHg|kg|cm|%|°C|ºC))?)/gi;

  for (const match of source.matchAll(pairRegex)) {
    const label = matchVitalLabel(match[1] ?? "");
    const value = (match[2] ?? "").replace(/\s+/g, " ").trim();
    if (!label || !value) continue;
    if (!result[label]) result[label] = value;
  }

  return result;
}

export function extractClinicalSection(
  text: string | null | undefined,
  headers: string[]
): string | null {
  const raw = text?.trim();
  if (!raw) return null;

  const headerPattern = headers.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(
    `(?:^|\\n)\\s*(?:${headerPattern})\\s*[:\\-]?\\s*([\\s\\S]*?)(?=\\n\\s*(?:laboratorio|estudios?|ecg|rx|radiograf|ecograf|resonanc|tomograf|informe|diagn[oó]stic|tratamiento|indicacion|evoluci|signos?\\s+vital)|$)`,
    "i"
  );
  const match = raw.match(regex);
  const body = match?.[1]?.trim();
  return body || null;
}

export type PrintConsultationDiagnosis = {
  name: string;
  cie10: string | null;
  chronic: boolean;
};

export function diagnosesForConsultation(
  consultation: PatientEhrConsultation,
  diagnosisRows: PatientEhrDiagnosisRow[]
): PrintConsultationDiagnosis[] {
  const structured = diagnosisRows.filter((row) => row.recordId === consultation.id);
  if (structured.length > 0) {
    return structured.map((row) => {
      const parsed = parseDiagnosisLine(row.name);
      return {
        name: parsed.text,
        cie10: parsed.code,
        chronic: row.chronic,
      };
    });
  }

  return parseInlineDiagnoses(consultation).map((item) => ({
    name: item.text,
    cie10: item.code,
    chronic: false,
  }));
}

export type PrintConsultationTreatment = {
  product: string;
  dose: string;
  frequency: string;
  notes: string;
  status: string;
};

export function treatmentsForConsultation(
  consultation: PatientEhrConsultation,
  treatmentRows: PatientEhrTreatmentRow[]
): PrintConsultationTreatment[] {
  const structured = treatmentRows.filter((row) => row.recordId === consultation.id);
  if (structured.length > 0) {
    return dedupeTreatmentRows(structured).map((row) => ({
      product: splitTreatmentProductLab(row.product).product || row.product,
      dose: row.dose !== "—" ? row.dose : "",
      frequency: row.frequency !== "—" ? row.frequency : "",
      notes: row.notes !== "—" && row.notes !== row.product ? row.notes : "",
      status: row.status,
    }));
  }
  return [];
}

function normalizeDedupeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function dedupeDiagnosisRows(rows: PatientEhrDiagnosisRow[]): PatientEhrDiagnosisRow[] {
  const byKey = new Map<string, PatientEhrDiagnosisRow>();
  for (const row of rows) {
    const parsed = parseDiagnosisLine(row.name);
    const key = `${normalizeDedupeToken(parsed.text)}|${parsed.code ?? ""}|${row.chronic ? "1" : "0"}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }
    if (new Date(row.recordCreatedAt).getTime() < new Date(existing.recordCreatedAt).getTime()) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()].sort(
    (a, b) => new Date(b.recordCreatedAt).getTime() - new Date(a.recordCreatedAt).getTime()
  );
}

export function isActiveTreatmentStatus(status: string | null | undefined): boolean {
  const value = (status ?? "").trim().toLowerCase();
  if (!value || value === "—") return true;
  return /actual|activo|vigente|cronico|crónico/.test(value) && !/suspend|finaliz|inactiv|alta|cese/.test(value);
}

export function dedupeTreatmentRows(rows: PatientEhrTreatmentRow[]): PatientEhrTreatmentRow[] {
  const byKey = new Map<string, PatientEhrTreatmentRow>();

  for (const row of rows) {
    const { product } = splitTreatmentProductLab(row.product);
    const brand = normalizeDedupeToken(product.split(/\s+/)[0] ?? product);
    const dose = normalizeDedupeToken(row.dose !== "—" ? row.dose : "");
    const frequency = normalizeDedupeToken(row.frequency !== "—" ? row.frequency : "");
    const key = `${brand}|${dose}|${frequency}`;

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }

    // Prefer the more informative product line when brand+dose match.
    const existingScore = existing.product.length + (existing.dose !== "—" ? existing.dose.length : 0);
    const nextScore = row.product.length + (row.dose !== "—" ? row.dose.length : 0);
    if (nextScore > existingScore) {
      byKey.set(key, row);
    }
  }

  return [...byKey.values()].sort(
    (a, b) => new Date(b.recordCreatedAt).getTime() - new Date(a.recordCreatedAt).getTime()
  );
}

export function formatPrintDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function formatPrintGeneratedAt(date: Date = new Date()): string {
  const { date: d, time } = formatPrintDateTime(date.toISOString());
  return `${d} ${time}`;
}

export function formatProfessionalLine(consultation: PatientEhrConsultation): string {
  const name = consultation.professional_name.trim() || "Profesional";
  const withTitle = /^dr\.?\b|^dra\.?\b/i.test(name) ? name : `Dr/a. ${name}`;
  const national = consultation.professional_license_national?.trim();
  const provincial = consultation.professional_license_provincial?.trim();
  const licenses: string[] = [];
  if (national) licenses.push(`MN ${national}`);
  if (provincial && provincial !== national) licenses.push(`MP ${provincial}`);
  return licenses.length > 0 ? `${withTitle} — ${licenses.join(" · ")}` : withTitle;
}

export function formatCompactMatricula(consultation: PatientEhrConsultation): string | null {
  const national = consultation.professional_license_national?.trim();
  const provincial = consultation.professional_license_provincial?.trim();
  if (national && provincial && provincial !== national) {
    return `Matrícula: MN ${national} · MP ${provincial}`;
  }
  if (national) return `Matrícula: MN ${national}`;
  if (provincial) return `Matrícula: MP ${provincial}`;
  return null;
}

export function evolutionBodyWithoutExtractedBlocks(text: string): string {
  return text
    .replace(/\n?\s*signos?\s+vitales?\s*[:\-]?[\s\S]*?(?=\n\s*\n|$)/i, "")
    .replace(
      /\n?\s*(?:laboratorio|estudios?\s+complementarios?|ecg|rx|radiograf(?:[íi]a)?|ecograf(?:[íi]a)?|resonanc(?:ia)?|tomograf(?:[íi]a)?|informe)\s*[:\-]?[\s\S]*?(?=\n\s*\n|$)/gi,
      ""
    )
    .trim();
}
