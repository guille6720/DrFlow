const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const DNI_RE = /\b\d{7,8}\b/g;
const PHONE_RE = /(?:\+?54[\s-]?)?(?:9[\s-]?)?\d{2,4}[\s-]?\d{6,8}/g;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strip identifiers from free-text before sending clinical context to an LLM. */
export function anonymizeClinicalText(text: string, identifiers: string[] = []): string {
  let out = text;
  const unique = [...new Set(identifiers.map((id) => id.trim()).filter((id) => id.length >= 3))];
  unique.sort((a, b) => b.length - a.length);

  for (const identifier of unique) {
    out = out.replace(new RegExp(escapeRegExp(identifier), "gi"), "[REDACTADO]");
  }

  return out
    .replace(EMAIL_RE, "[EMAIL]")
    .replace(DNI_RE, "[DNI]")
    .replace(PHONE_RE, "[TEL]")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function ageYearsFromBirthDate(birthDate: string | null | undefined, now = new Date()): number | null {
  if (!birthDate) return null;
  const born = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(born.getTime())) return null;
  let age = now.getFullYear() - born.getFullYear();
  const monthDelta = now.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < born.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}
