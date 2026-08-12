export type ParsedClinicalTemplatePaste = {
  name: string;
  specialty: string;
  chief_complaint_template: string;
  diagnosis_template: string;
  evolution_template: string;
  indications_template: string;
};

type SectionKey = keyof ParsedClinicalTemplatePaste;

const SECTION_ALIASES: Record<SectionKey, string[]> = {
  name: ["nombre", "name", "plantilla", "titulo", "título"],
  specialty: ["especialidad", "specialty"],
  chief_complaint_template: [
    "motivo",
    "motivo de consulta",
    "motivo consulta",
    "chief_complaint",
    "mc",
  ],
  diagnosis_template: [
    "diagnostico",
    "diagnóstico",
    "diagnosis",
    "dx",
    "impresion diagnostica",
    "impresión diagnóstica",
  ],
  evolution_template: [
    "evolucion",
    "evolución",
    "evolution",
    "texto de evolucion",
    "texto de evolución",
    "soap",
    "nota",
  ],
  indications_template: ["indicaciones", "indications", "plan", "tratamiento", "recomendaciones"],
};

const EMPTY_PARSED: ParsedClinicalTemplatePaste = {
  name: "",
  specialty: "",
  chief_complaint_template: "",
  diagnosis_template: "",
  evolution_template: "",
  indications_template: "",
};

function normalizeLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

function stripMarkdownHeader(line: string): string {
  return line.replace(/^#{1,6}\s*/, "").trim();
}

function matchSectionHeader(line: string): { key: SectionKey; inlineValue: string } | null {
  const cleaned = stripMarkdownHeader(line.trim());
  if (!cleaned) return null;

  const colonIdx = cleaned.indexOf(":");
  const labelPart = colonIdx >= 0 ? cleaned.slice(0, colonIdx).trim() : cleaned;
  const inlineValue = colonIdx >= 0 ? cleaned.slice(colonIdx + 1).trim() : "";
  const normalizedLabel = normalizeLabel(labelPart.replace(/\s*\([^)]*\)\s*$/, ""));

  for (const [key, aliases] of Object.entries(SECTION_ALIASES) as [SectionKey, string[]][]) {
    if (aliases.some((alias) => normalizedLabel === normalizeLabel(alias))) {
      return { key, inlineValue };
    }
  }

  return null;
}

function trimSection(value: string): string {
  return value.replace(/^\s+|\s+$/g, "").replace(/\n{3,}/g, "\n\n");
}

function mapJsonObject(raw: Record<string, unknown>): ParsedClinicalTemplatePaste {
  const pick = (...keys: string[]): string => {
    for (const key of keys) {
      const value = raw[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  };

  return {
    name: pick("name", "nombre", "plantilla", "titulo", "título"),
    specialty: pick("specialty", "especialidad"),
    chief_complaint_template: pick(
      "chief_complaint_template",
      "chief_complaint",
      "motivo",
      "motivo_de_consulta",
      "motivo_consulta"
    ),
    diagnosis_template: pick("diagnosis_template", "diagnosis", "diagnostico", "diagnóstico"),
    evolution_template: pick("evolution_template", "evolution", "evolucion", "evolución"),
    indications_template: pick(
      "indications_template",
      "indications",
      "indicaciones",
      "plan",
      "tratamiento"
    ),
  };
}

function hasParsedContent(parsed: ParsedClinicalTemplatePaste): boolean {
  return Object.values(parsed).some((value) => value.trim().length > 0);
}

function deriveName(parsed: ParsedClinicalTemplatePaste): string {
  if (parsed.name.trim()) return parsed.name.trim().slice(0, 120);

  const evolutionFirstLine = parsed.evolution_template.split("\n").find((line) => line.trim())?.trim();
  if (
    evolutionFirstLine &&
    evolutionFirstLine.length <= 60 &&
    !evolutionFirstLine.endsWith(".") &&
    !evolutionFirstLine.includes(":")
  ) {
    return evolutionFirstLine.slice(0, 120);
  }

  const chiefFirstLine = parsed.chief_complaint_template.split("\n").find((line) => line.trim())?.trim();
  if (
    chiefFirstLine &&
    chiefFirstLine.length <= 60 &&
    !chiefFirstLine.endsWith(".") &&
    !chiefFirstLine.includes(":")
  ) {
    return chiefFirstLine.slice(0, 120);
  }

  return "Nueva plantilla";
}

/** Parse pasted predefined clinical template text into form fields. */
export function parseClinicalTemplatePaste(raw: string): ParsedClinicalTemplatePaste {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) return { ...EMPTY_PARSED };

  const firstBlock = text.split(/\n\s*---+\s*\n/)[0]?.trim() ?? text;

  if (firstBlock.startsWith("{")) {
    try {
      const parsed = mapJsonObject(JSON.parse(firstBlock) as Record<string, unknown>);
      if (hasParsedContent(parsed)) {
        return { ...parsed, name: deriveName(parsed) };
      }
    } catch {
      /* fall through to section parser */
    }
  }

  const buffers: Partial<Record<SectionKey, string[]>> = {};
  let currentKey: SectionKey | null = null;
  const preamble: string[] = [];

  for (const line of firstBlock.split("\n")) {
    const header = matchSectionHeader(line);
    if (header) {
      currentKey = header.key;
      if (header.inlineValue) {
        buffers[currentKey] = [header.inlineValue];
      } else if (!buffers[currentKey]) {
        buffers[currentKey] = [];
      }
      continue;
    }

    if (currentKey) {
      (buffers[currentKey] ??= []).push(line);
    } else if (line.trim()) {
      preamble.push(line);
    }
  }

  const parsed: ParsedClinicalTemplatePaste = {
    name: trimSection((buffers.name ?? []).join("\n")),
    specialty: trimSection((buffers.specialty ?? []).join("\n")),
    chief_complaint_template: trimSection((buffers.chief_complaint_template ?? []).join("\n")),
    diagnosis_template: trimSection((buffers.diagnosis_template ?? []).join("\n")),
    evolution_template: trimSection((buffers.evolution_template ?? []).join("\n")),
    indications_template: trimSection((buffers.indications_template ?? []).join("\n")),
  };

  if (!parsed.name && preamble.length > 0) {
    const preambleText = trimSection(preamble.join("\n"));
    const firstPreamble = preamble[0]?.trim() ?? "";
    const looksLikeTitle =
      preamble.length === 1 &&
      firstPreamble.length <= 60 &&
      !firstPreamble.endsWith(".") &&
      !firstPreamble.includes(":");

    if (looksLikeTitle) {
      parsed.name = firstPreamble;
    } else if (!parsed.evolution_template) {
      parsed.evolution_template = preambleText;
    }
  }

  if (!hasParsedContent(parsed)) {
    return {
      ...EMPTY_PARSED,
      evolution_template: trimSection(firstBlock),
      name: deriveName({ ...EMPTY_PARSED, evolution_template: firstBlock }),
    };
  }

  return { ...parsed, name: deriveName(parsed) };
}

export function resolveSpecialtyIdFromPaste(
  specialtyName: string,
  specialties: { id: string; name: string }[]
): string {
  const norm = normalizeLabel(specialtyName);
  if (!norm) return "";

  const exact = specialties.find((s) => normalizeLabel(s.name) === norm);
  if (exact) return exact.id;

  const partial = specialties.filter((s) => {
    const specialtyNorm = normalizeLabel(s.name);
    return specialtyNorm.includes(norm) || norm.includes(specialtyNorm);
  });
  if (partial.length === 1) return partial[0].id;

  return "";
}

export const CLINICAL_TEMPLATE_PASTE_FORMAT = `Nombre: Control HTA

Motivo de consulta:
Control de hipertensión arterial.

Diagnóstico:
Hipertensión arterial esencial (I10)

Evolución:
Paciente en buen estado general. PA: [___/___ mmHg].
Examen cardiovascular sin hallazgos relevantes.

Indicaciones:
Dieta hiposódica. Control en [30] días.`;

export const CLINICAL_TEMPLATE_PASTE_EXAMPLES = [
  {
    label: "Control HTA",
    text: CLINICAL_TEMPLATE_PASTE_FORMAT,
  },
  {
    label: "Primera consulta",
    text: `Nombre: Primera consulta

Motivo de consulta:
Primera consulta por cuadro agudo.

Evolución:
Paciente refiere inicio de síntomas hace ___ días.
Antecedentes: (completar).
Examen físico: (completar).
Impresión diagnóstica: (completar).

Indicaciones:
Estudios complementarios según criterio.
Control en ___ días.`,
  },
] as const;
