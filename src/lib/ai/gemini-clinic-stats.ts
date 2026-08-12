import {
  findProtocolByMessage,
  foldMedicalText,
  formatProtocolCatalogForPrompt,
  GEMINI_CLINICAL_PROTOCOLS,
  GEMINI_LEXICON_CONDITIONS,
  type GeminiClinicalProtocol,
  type GeminiLexiconCondition,
} from "@/lib/ai/gemini-medical-lexicon";

export type GeminiStatsPeriodId =
  | "daily"
  | "weekly"
  | "monthly"
  | "last_month"
  | "year"
  | "all";

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
  protocol: GeminiClinicalProtocol | null;
  wantProtocolCriteria: boolean;
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
  protocolLabel: string | null;
  protocolContext: string | null;
};

const STATS_HINT =
  /cu[aá]nt[oa]s?|cantidad|listad[oa]|lista\s+de|estad[ií]st|ranking|promedio|porcentaje|atendid|consultas?\s+(este|esta|hoy|del|de\s+este)|pacientes?\s+con|este\s+mes|esta\s+semana|hoy\b|ayer\b|este\s+a[nñ]o|mes\s+pasado|m[aá]s\s+frecuentes|diagn[oó]sticos?\s+m[aá]s|candidat|protocolo|estudio\s+|deriv(ar|aci[oó]n)|maritime|gzmr|gzpw|presto|theseus|ekgb|muvalaplin|bax.?d[uú]o|bronquiect|polaris|zenagamtide|azure|orforglipr|cagrisema|ascvd|hfpef|hfmref|lp\(?a\)?/i;

const CLINICAL_ONLY_HINT =
  /evoluci[oó]n|resumen\s+del\s+paciente|motivo\s+de\s+consulta|redact[aá]|soap|alertas?\s+de\s+seguimiento/i;

const PERIOD_HINT =
  /\bhoy\b|\bayer\b|esta\s+semana|este\s+mes|mes\s+pasado|este\s+a[nñ]o|ultimos?\s+7\s+dias|del\s+mes|en\s+el\s+mes|historico|hist[oó]rico|en\s+drflow|toda\s+la\s+base/i;

/** @deprecated Prefer GEMINI_LEXICON_CONDITIONS — kept for tests/compat. */
export const GEMINI_STATS_CONDITIONS: GeminiStatsCondition[] = GEMINI_LEXICON_CONDITIONS;

export function foldStatsText(value: string): string {
  return foldMedicalText(value);
}

function conditionFromLexicon(item: GeminiLexiconCondition): GeminiStatsCondition {
  return { id: item.id, label: item.label, needles: item.needles };
}

function matchCondition(folded: string): GeminiStatsCondition | null {
  let best: GeminiStatsCondition | null = null;
  let bestLen = 0;

  for (const condition of GEMINI_LEXICON_CONDITIONS) {
    for (const needle of condition.needles) {
      const n = needle.trim();
      if (n.length >= 2 && folded.includes(n) && n.length > bestLen) {
        best = conditionFromLexicon(condition);
        bestLen = n.length;
      }
    }
  }

  if (best) return best;

  const withMatch = folded.match(
    /pacientes?\s+con\s+([a-z0-9\s()-]{3,40}?)(?:\s+(?:este|esta|el|la|hoy|ayer|se\s+atend|atendid|en\s+el|para|del)|[?,.]|$)/i
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

function matchPeriod(folded: string, hasConditionOrProtocol: boolean): GeminiStatsPeriodId {
  if (/\bayer\b/.test(folded)) return "daily";
  if (/\bhoy\b/.test(folded)) return "daily";
  if (/esta\s+semana|ultimos?\s+7\s+dias/.test(folded)) return "weekly";
  if (/mes\s+pasado|el\s+mes\s+anterior/.test(folded)) return "last_month";
  if (/este\s+anio|este\s+ano|del\s+anio/.test(folded)) return "year";
  if (/historico|en\s+drflow|toda\s+la\s+base|siempre/.test(folded)) return "all";
  if (/este\s+mes|del\s+mes|en\s+el\s+mes/.test(folded)) return "monthly";
  // Term/protocol search without explicit period → whole clinic history in DrFlow.
  if (hasConditionOrProtocol && !PERIOD_HINT.test(folded)) return "all";
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

function conditionFromProtocol(protocol: GeminiClinicalProtocol): GeminiStatsCondition {
  const related = GEMINI_LEXICON_CONDITIONS.filter((c) => protocol.conditionIds.includes(c.id));
  const needles = [
    ...protocol.candidateNeedles.map((n) => foldMedicalText(n)),
    ...related.flatMap((c) => c.needles),
  ];
  return {
    id: `protocol:${protocol.id}`,
    label: `candidatos ${protocol.label}`,
    needles: [...new Set(needles.filter(Boolean))],
  };
}

/** True when the doctor is asking for clinic-wide counts/lists/protocols, not a single HC. */
export function parseGeminiClinicStatsQuery(message: string): GeminiClinicStatsQuery | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  const folded = foldStatsText(trimmed);
  if (CLINICAL_ONLY_HINT.test(trimmed) && !STATS_HINT.test(trimmed)) return null;

  const protocol = findProtocolByMessage(folded);
  const wantProtocolCriteria =
    Boolean(protocol) &&
    /criterio|protocolo|estudio|incluir|inclusion|exclusi|deriv|candidato|perfil|que\s+paciente|buscar/.test(
      folded
    );

  const conditionFromText = matchCondition(folded);
  const condition =
    protocol && (/candidat|pacientes?\s+para|deriv|buscar|listad|cuantos|cantidad/.test(folded) || !conditionFromText)
      ? conditionFromProtocol(protocol)
      : conditionFromText;

  if (!STATS_HINT.test(trimmed) && !protocol) return null;

  const hasConditionOrProtocol = Boolean(condition || protocol);

  return {
    period: matchPeriod(folded, hasConditionOrProtocol),
    condition,
    coverageNeedle: matchCoverage(folded),
    wantTopDiagnoses: /mas\s+frecuentes|ranking|diagnosticos?\s+mas|top\s+diagn/.test(folded),
    protocol,
    wantProtocolCriteria: wantProtocolCriteria || Boolean(protocol && !conditionFromText),
  };
}

export function textMatchesCondition(text: string, condition: GeminiStatsCondition): boolean {
  const folded = ` ${foldStatsText(text)} `;
  return condition.needles.some((needle) => {
    const n = needle.trim();
    return n.length >= 2 && folded.includes(n);
  });
}

export function formatGeminiClinicStatsContext(result: GeminiClinicStatsResult): string {
  const header = [
    result.protocolLabel ? `Protocolo: ${result.protocolLabel}` : null,
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
      : "Pacientes: ninguno en el período con esos términos en la HC de DrFlow.";

  return [result.protocolContext, header, diagnoses, patients].filter(Boolean).join("\n\n");
}

export function listKnownProtocolAliases(): string[] {
  return GEMINI_CLINICAL_PROTOCOLS.flatMap((p) => p.aliases);
}

export { formatProtocolCatalogForPrompt, GEMINI_CLINICAL_PROTOCOLS };
