export type GeminiStatsPatient = {
  id: string;
  name: string;
  date: string;
  diagnosis: string;
};

export type GeminiStructuredResponse = {
  summary: string;
  findings: string[];
  suggestions: string[];
  warnings: string[];
  disclaimer: string;
  patients?: GeminiStatsPatient[];
};

const DEFAULT_DISCLAIMER =
  "Sugerencia asistida — requiere confirmación del médico. No reemplaza criterio clínico.";

function asPatientArray(value: unknown): GeminiStatsPatient[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id.trim() : "";
      const name = typeof row.name === "string" ? row.name.trim() : "";
      if (!id || !name) return null;
      return {
        id,
        name,
        date: typeof row.date === "string" ? row.date : "",
        diagnosis: typeof row.diagnosis === "string" ? row.diagnosis : "",
      };
    })
    .filter((row): row is GeminiStatsPatient => Boolean(row))
    .slice(0, 200);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 40);
}

export function emptyGeminiStructuredResponse(summary = ""): GeminiStructuredResponse {
  return {
    summary,
    findings: [],
    suggestions: [],
    warnings: [],
    disclaimer: DEFAULT_DISCLAIMER,
  };
}

/** Parse Gemini JSON; fall back to wrapping free text as a summary. */
export function parseGeminiStructuredResponse(raw: string): GeminiStructuredResponse {
  const trimmed = raw.trim();
  if (!trimmed) return emptyGeminiStructuredResponse();

  const jsonBlock = extractJsonObject(trimmed);
  if (jsonBlock) {
    try {
      const parsed = JSON.parse(jsonBlock) as Record<string, unknown>;
      const summary =
        (typeof parsed.summary === "string" && parsed.summary.trim()) ||
        (typeof parsed.respuesta === "string" && parsed.respuesta.trim()) ||
        "";
      return {
        summary,
        findings: asStringArray(parsed.findings ?? parsed.hallazgos),
        suggestions: asStringArray(parsed.suggestions ?? parsed.sugerencias),
        warnings: asStringArray(parsed.warnings ?? parsed.alertas),
        disclaimer:
          typeof parsed.disclaimer === "string" && parsed.disclaimer.trim()
            ? parsed.disclaimer.trim()
            : DEFAULT_DISCLAIMER,
        patients: asPatientArray(parsed.patients ?? parsed.pacientes),
      };
    } catch {
      /* wrap as summary */
    }
  }

  return emptyGeminiStructuredResponse(trimmed);
}

function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

export function formatGeminiStructuredBody(response: GeminiStructuredResponse): string {
  const sections = [response.summary];
  if (response.findings.length) {
    sections.push(`Hallazgos:\n${response.findings.map((item) => `• ${item}`).join("\n")}`);
  }
  if (response.suggestions.length) {
    sections.push(`Sugerencias:\n${response.suggestions.map((item) => `• ${item}`).join("\n")}`);
  }
  if (response.warnings.length) {
    sections.push(`Alertas:\n${response.warnings.map((item) => `• ${item}`).join("\n")}`);
  }
  if (response.patients && response.patients.length > 0) {
    sections.push(
      `Pacientes (${response.patients.length}):\n${response.patients
        .map((item) => `• ${item.name}${item.date ? ` · ${item.date}` : ""}${item.diagnosis ? ` — ${item.diagnosis}` : ""}`)
        .join("\n")}`
    );
  }
  sections.push(response.disclaimer);
  return sections.filter(Boolean).join("\n\n");
}
