export const TEMPLATE_VARIABLE_REGEX = /\[([^\]]+)\]/g;

export type ClinicalTemplateFieldSet = {
  chief_complaint: string;
  diagnosis: string;
  evolution: string;
  indications: string;
};

export function extractTemplateVariableKeys(...texts: string[]): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];

  for (const text of texts) {
    for (const match of text.matchAll(TEMPLATE_VARIABLE_REGEX)) {
      const key = match[1]?.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
    }
  }

  return keys;
}

export function applyTemplateVariableValues(
  text: string,
  values: Record<string, string>
): string {
  return text.replace(TEMPLATE_VARIABLE_REGEX, (_, key: string) => {
    const value = values[key]?.trim();
    return value ? value : `[${key}]`;
  });
}

export function resolveClinicalTemplateFields(
  bases: ClinicalTemplateFieldSet,
  values: Record<string, string>
): ClinicalTemplateFieldSet {
  return {
    chief_complaint: applyTemplateVariableValues(bases.chief_complaint, values),
    diagnosis: applyTemplateVariableValues(bases.diagnosis, values),
    evolution: applyTemplateVariableValues(bases.evolution, values),
    indications: applyTemplateVariableValues(bases.indications, values),
  };
}
