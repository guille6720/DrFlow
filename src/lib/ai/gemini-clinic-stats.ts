export type GeminiStatsPeriodId = "daily" | "weekly" | "monthly" | "last_month" | "year";

export type GeminiStatsCondition = {
  id: string;
  label: string;
  /** Folded (unaccented, lowercase) needles matched against diagnosis text. */
  needles: string[];
};

export type GeminiClinicStatsQuery = {
  period: GeminiStatsPeriodId;
  condition: GeminiStatsCondition | null;
  coverageNeedle: string | null;
  wantTopDiagnoses: boolean;
};

export type GeminiStatsPatientRow = {
  id: string;
  name: string;
  date: string;
  diagnosis: string;
  coverage: string | null;
};

export type GeminiClinicStatsResult = {
  periodLabel: string;
  conditionLabel: string | null;
  coverageLabel: string | null;
  visitCount: number;
  patientCount: number;
  truncated: boolean;
  patients: GeminiStatsPatientRow[];
  topDiagnoses: Array<{ label: string; count: number }>;
};

const STATS_HINT =
  /cu[aá]nt[oa]s?|cantidad|listad[oa]|lista\s+de|estad[ií]st|ranking|promedio|porcentaje|atendid|consultas?\s+(este|esta|hoy|del|de\s+este)|pacientes?\s+con|este\s+mes|esta\s+semana|hoy\b|ayer\b|este\s+a[nñ]o|mes\s+pasado|m[aá]s\s+frecuentes|diagn[oó]sticos?\s+m[aá]s/i;

const CLINICAL_ONLY_HINT =
  /evoluci[oó]n|resumen\s+del\s+paciente|motivo\s+de\s+consulta|redact[aá]|soap|alertas?\s+de\s+seguimiento/i;

export const GEMINI_STATS_CONDITIONS: GeminiStatsCondition[] = [
  {
    id: "hta",
    label: "hipertensión",
    needles: ["hipertens", " hta", "hta ", "hta,", "i10", "i11", "i12", "i13", "i15", "presion alta"],
  },
  {
    id: "diabetes",
    label: "diabetes",
    needles: ["diabetes", "dbt", "dm2", "dm1", "dm tipo", "e10", "e11", "e14", "glucem"],
  },
  {
    id: "asma",
    label: "asma",
    needles: ["asma", "j45"],
  },
  {
    id: "hipotiroidismo",
    label: "hipotiroidismo",
    needles: ["hipotiroid", "e03"],
  },
  {
    id: "dislipidemia",
    label: "dislipidemia",
    needles: ["dislipid", "colesterol", "e78"],
  },
  {
    id: "obesidad",
    label: "obesidad",
    needles: ["obesidad", "e66"],
  },
  {
    id: "ansiedad",
    label: "ansiedad",
    needles: ["ansiedad", "f41"],
  },
  {
    id: "depresion",
    label: "depresión",
    needles: ["depresi", "f32", "f33"],
  },
];

export function foldStatsText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function matchCondition(folded: string): GeminiStatsCondition | null {
  for (const condition of GEMINI_STATS_CONDITIONS) {
    if (condition.needles.some((needle) => folded.includes(needle.trim()))) {
      return condition;
    }
  }

  const withMatch = folded.match(
    /pacientes?\s+con\s+([a-z0-9\s-]{3,40}?)(?:\s+(?:este|esta|el|la|hoy|ayer|se\s+atend|atendid|en\s+el)|[?,.]|$)/i
  );
  const extracted = withMatch?.[1]?.trim();
  if (extracted && extracted.length >= 3) {
    return {
      id: "custom",
      label: extracted,
      needles: [extracted],
    };
  }

  return null;
}

function matchPeriod(folded: string): GeminiStatsPeriodId {
  if (/\bayer\b/.test(folded)) return "daily";
  if (/\bhoy\b/.test(folded)) return "daily";
  if (/esta\s+semana|ultimos?\s+7\s+dias/.test(folded)) return "weekly";
  if (/mes\s+pasado|el\s+mes\s+anterior/.test(folded)) return "last_month";
  if (/este\s+anio|este\s+ano|del\s+anio/.test(folded)) return "year";
  return "monthly";
}

function matchCoverage(folded: string): string | null {
  if (/\bpami\b/.test(folded)) return "pami";
  if (/\bosde\b/.test(folded)) return "osde";
  if (/\bswiss\b/.test(folded)) return "swiss";
  if (/\bgaleno\b/.test(folded)) return "galeno";
  if (/\bioma\b/.test(folded)) return "ioma";
  return null;
}

/** True when the doctor is asking for clinic-wide counts/lists, not a single HC. */
export function parseGeminiClinicStatsQuery(message: string): GeminiClinicStatsQuery | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  const folded = foldStatsText(trimmed);
  if (CLINICAL_ONLY_HINT.test(trimmed) && !STATS_HINT.test(trimmed)) return null;
  if (!STATS_HINT.test(trimmed)) return null;

  return {
    period: matchPeriod(folded),
    condition: matchCondition(folded),
    coverageNeedle: matchCoverage(folded),
    wantTopDiagnoses: /mas\s+frecuentes|ranking|diagnosticos?\s+mas|top\s+diagn/.test(folded),
  };
}

export function textMatchesCondition(text: string, condition: GeminiStatsCondition): boolean {
  const folded = ` ${foldStatsText(text)} `;
  return condition.needles.some((needle) => folded.includes(needle));
}

export function formatGeminiClinicStatsContext(result: GeminiClinicStatsResult): string {
  const header = [
    `Período: ${result.periodLabel}`,
    result.conditionLabel ? `Filtro: ${result.conditionLabel}` : null,
    result.coverageLabel ? `Cobertura: ${result.coverageLabel}` : null,
    `Consultas: ${result.visitCount}`,
    `Pacientes únicos: ${result.patientCount}`,
    result.truncated ? "Listado recortado al máximo permitido." : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const diagnoses =
    result.topDiagnoses.length > 0
      ? `Diagnósticos más frecuentes:\n${result.topDiagnoses
          .map((row) => `• ${row.label}: ${row.count}`)
          .join("\n")}`
      : null;

  const patients =
    result.patients.length > 0
      ? `Pacientes:\n${result.patients
          .map((row) => `• ${row.name} (${row.date})${row.diagnosis ? ` — ${row.diagnosis}` : ""}`)
          .join("\n")}`
      : "Pacientes: ninguno en el período.";

  return [header, diagnoses, patients].filter(Boolean).join("\n\n");
}
