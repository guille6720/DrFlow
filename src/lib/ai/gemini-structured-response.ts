export type GeminiStructuredResponse = {
  summary: string;
  findings: string[];
  suggestions: string[];
  warnings: string[];
  disclaimer: string;
};

const DEFAULT_DISCLAIMER =
  "Sugerencia asistida — requiere confirmación del médico. No reemplaza criterio clínico.";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 12);
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
  sections.push(response.disclaimer);
  return sections.filter(Boolean).join("\n\n");
}
