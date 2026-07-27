const LEGACY_PDF_MONTHS: Record<string, number> = {
  ENE: 0,
  FEB: 1,
  MAR: 2,
  ABR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AGO: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DIC: 11,
};

const LEGACY_EVOLUTION_HEADER =
  /^\d{2}-[A-ZÁÉÍÓÚÑ]{3}-\d{2,4}\s+[A-Za-zÁÉÍÓÚáéíóúÑñ\s,'.-]+$/m;

const LEGACY_EVOLUTION_HEADER_ALT =
  /^\d{1,2}\/\d{1,2}\/\d{2,4}\s+[A-Za-zÁÉÍÓÚáéíóúÑñ\s,'.-]+$/m;

const NOISE_LINE =
  /^(Evoluciones|-- \d+ of \d+ --|\d{2}:\d{2}:\d{2}\s|osleonardi@gmail\.com|\d{6}\s+\d{6}|Roemmers|Pfizer|Richet|Genomma|Montpellier|Bayer|Boehringer|AstraZeneca|Vannier|Leona|45534|osleo)$/i;

export interface LegacyClinicalDemographics {
  phone: string | null;
  insurance_provider: string | null;
  insurance_number: string | null;
  birth_date: string | null;
  chronic_diagnoses: string[];
}

export interface LegacyClinicalEvolutionEntry {
  marker: string;
  consultationDate: string;
  professionalName: string;
  timeLabel: string | null;
  chief_complaint: string;
  evolution: string;
  diagnosis: string;
  indications: string;
}

export function isLegacyClinicalPdfExport(text: string): boolean {
  const normalized = text.replace(/\r/g, "\n");
  if (!/Evoluciones/i.test(normalized)) return false;
  const hasHeader =
    LEGACY_EVOLUTION_HEADER.test(normalized) || LEGACY_EVOLUTION_HEADER_ALT.test(normalized);
  if (!hasHeader && !/\bDiagn[oó]sticos\b/i.test(normalized)) return false;
  return (
    /\bDNI\s*\n\s*[\d.]{7,11}/i.test(normalized) ||
    /\bNombre\s*\n/i.test(normalized) ||
    /\bTel[eé]fono\s*\n/i.test(normalized)
  );
}

export function parseLegacyClinicalBirthDate(text: string): string | null {
  const match = text.match(/Edad\s+(\d{1,2})\s+([A-ZÁÉÍÓÚÑ]{3})\s+(\d{4})/i);
  if (!match) return null;
  const day = Number(match[1]);
  const month = LEGACY_PDF_MONTHS[match[2].toUpperCase()];
  const year = Number(match[3]);
  if (month === undefined || !Number.isFinite(day) || !Number.isFinite(year)) return null;
  const iso = new Date(Date.UTC(year, month, day));
  if (Number.isNaN(iso.getTime())) return null;
  return iso.toISOString().slice(0, 10);
}

export function parseLegacyClinicalDemographics(text: string): LegacyClinicalDemographics {
  const normalized = text.replace(/\r/g, "\n");
  const phones: string[] = [];
  const phoneRe = /Tel[eé]fono\s*\n\s*(\+?\d[\d\s-]{8,})/gi;
  let phoneMatch: RegExpExecArray | null;
  while ((phoneMatch = phoneRe.exec(normalized)) !== null) {
    const cleaned = phoneMatch[1].replace(/\s+/g, " ").trim();
    if (!phones.includes(cleaned)) phones.push(cleaned);
  }

  const pamiMatch = normalized.match(/PAMI\s*\n\s*#?\s*(\d{10,20})/i);
  const insurance_number = pamiMatch?.[1]?.trim() ?? null;

  return {
    phone: phones[0] ?? null,
    insurance_provider: insurance_number ? "PAMI" : null,
    insurance_number,
    birth_date: parseLegacyClinicalBirthDate(normalized),
    chronic_diagnoses: parseLegacyClinicalChronicDiagnoses(normalized),
  };
}

export function parseLegacyClinicalChronicDiagnoses(text: string): string[] {
  const idx = text.search(/\nDiagn[oó]sticos\s*\n/i);
  if (idx < 0) return [];
  const tail = text.slice(idx);
  const end = tail.search(/\nTratamientos\s*\n/i);
  const section = end >= 0 ? tail.slice(0, end) : tail.slice(0, 4000);
  const lines = section.split("\n").map((l) => l.trim()).filter(Boolean);
  const diagnoses: string[] = [];
  for (const line of lines) {
    if (/^Diagn[oó]sticos$/i.test(line)) continue;
    if (/^Fecha\s/i.test(line)) continue;
    if (/^Cr[oó]nico$/i.test(line)) continue;
    if (/^\d{2}-[A-Z]{3}/i.test(line)) continue;
    if (/osleonardi@gmail\.com/i.test(line)) continue;
    if (/^\d{6}\s+\d{6}$/.test(line)) continue;
    if (line.length < 4 || line.length > 120) continue;
    if (!/[a-záéíóúñ]/i.test(line)) continue;
    if (!diagnoses.includes(line)) diagnoses.push(line);
  }
  return diagnoses;
}

function parseLegacyDateToken(token: string): string | null {
  let match = token.match(/^(\d{2})-([A-ZÁÉÍÓÚÑ]{3})-(\d{2})$/i);
  if (match) {
    const day = Number(match[1]);
    const month = LEGACY_PDF_MONTHS[match[2].toUpperCase()];
    const year = 2000 + Number(match[3]);
    if (month === undefined) return null;
    const d = new Date(Date.UTC(year, month, day));
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }

  match = token.match(/^(\d{2})-([A-ZÁÉÍÓÚÑ]{3})-(\d{4})$/i);
  if (match) {
    const day = Number(match[1]);
    const month = LEGACY_PDF_MONTHS[match[2].toUpperCase()];
    const year = Number(match[3]);
    if (month === undefined) return null;
    const d = new Date(Date.UTC(year, month, day));
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }

  match = token.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    if (month < 0 || month > 11) return null;
    const d = new Date(Date.UTC(year, month, day));
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }

  return null;
}

function isEvolutionBlockHeader(trimmed: string): boolean {
  if (/^\d{2}-[A-ZÁÉÍÓÚÑ]{3}-\d{2,4}\s+[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(trimmed)) return true;
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}\s+[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(trimmed)) return true;
  return false;
}

function parseEvolutionHeader(header: string): { dateToken: string; professionalName: string } | null {
  const dash = header.match(/^(\d{2}-[A-ZÁÉÍÓÚÑ]{3}-\d{2,4})\s+(.+)$/i);
  if (dash) return { dateToken: dash[1], professionalName: dash[2].trim() };
  const slash = header.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+)$/i);
  if (slash) return { dateToken: slash[1], professionalName: slash[2].trim() };
  return null;
}

function cleanEvolutionBody(raw: string): string {
  return raw
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (NOISE_LINE.test(t)) return false;
      if (/^\d{2}:\d{2}:\d{2}\s/.test(t)) return false;
      if (/osleonardi@gmail\.com/i.test(t)) return false;
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractSection(body: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return "";
}

function buildChiefComplaint(body: string, dateIso: string): string {
  const titleLine = body
    .split("\n")
    .map((l) => l.trim())
    .find(
      (l) =>
        l.length >= 8 &&
        l.length <= 160 &&
        (l === l.toUpperCase() || /^REPORTE|^INFORME|^RESUMEN|^HISTORIA|^CIERRE|^📝|^📢|^📝/.test(l))
    );
  if (titleLine) return titleLine.replace(/\s+/g, " ").slice(0, 500);
  const context = extractSection(body, [
    /(?:Enfermedad Actual|Contexto(?: Clínico)?(?: Previo)?)[:\s]*([\s\S]{20,1200}?)(?=\n\d[\.\)]|\nSignos Vitales|\nEvolución)/i,
  ]);
  if (context) return context.slice(0, 500);
  return `Evolución importada (${dateIso})`;
}

function splitEvolutionBlocks(text: string): Array<{ header: string; body: string }> {
  const normalized = text.replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const blocks: Array<{ header: string; body: string }> = [];
  let currentHeader: string | null = null;
  let bodyLines: string[] = [];

  const flush = () => {
    if (!currentHeader) return;
    blocks.push({ header: currentHeader, body: bodyLines.join("\n") });
    bodyLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (isEvolutionBlockHeader(trimmed)) {
      flush();
      currentHeader = trimmed;
      continue;
    }
    if (currentHeader) bodyLines.push(line);
  }
  flush();
  return blocks;
}

export function parseLegacyClinicalEvolutions(text: string): LegacyClinicalEvolutionEntry[] {
  const blocks = splitEvolutionBlocks(text);
  const entries: LegacyClinicalEvolutionEntry[] = [];

  for (const block of blocks) {
    const parsedHeader = parseEvolutionHeader(block.header);
    if (!parsedHeader) continue;

    const dateIso = parseLegacyDateToken(parsedHeader.dateToken);
    if (!dateIso) continue;

    const professionalName = parsedHeader.professionalName;
    const timeMatch = block.body.match(/\n(\d{2}:\d{2}:\d{2})\s+/);
    const timeLabel = timeMatch?.[1] ?? null;
    const marker = `[Import:${dateIso}${timeLabel ? `T${timeLabel}` : ""}]`;

    const cleaned = cleanEvolutionBody(block.body);
    if (cleaned.length < 20) continue;

    const indications = extractSection(cleaned, [
      /(?:Conducta(?: Médica)?(?: y Plan Terap[eé]utico)?|Plan(?: Terap[eé]utico)?(?: y Conducta M[eé]dica)?|Plan y Conducta|Conducta)[:\s]*([\s\S]+?)(?=\n\d[\.\)]\s|$)/i,
      /(?:Medidas y Acciones|Seguimiento)[:\s]*([\s\S]{20,2000}?)(?=\n\d[\.\)]\s|$)/i,
    ]);

    let evolutionBody = cleaned;
    if (indications) {
      evolutionBody = cleaned.replace(indications, "").trim();
    }

    const diagnosis = extractSection(cleaned, [
      /(?:Evaluaci[oó]n Cl[ií]nica|Diagn[oó]stico)[:\s]*([\s\S]{10,800}?)(?=\n(?:Justificaci[oó]n|Plan|Conducta|\d[\.\)]))/i,
    ]);

    const chief_complaint = buildChiefComplaint(cleaned, dateIso);

    entries.push({
      marker,
      consultationDate: dateIso,
      professionalName,
      timeLabel,
      chief_complaint: `${marker} ${chief_complaint}`.slice(0, 600),
      evolution: evolutionBody.slice(0, 12000),
      diagnosis: diagnosis.slice(0, 4000),
      indications: indications.slice(0, 4000),
    });
  }

  return entries;
}

/** Si el PDF no partió en bloques por fecha, importa el cuerpo de Evoluciones como una consulta. */
export function parseLegacyClinicalEvolutionsFallback(
  text: string
): LegacyClinicalEvolutionEntry[] {
  const normalized = text.replace(/\r/g, "\n");
  const match = normalized.match(/\nEvoluciones\s*\n([\s\S]+?)(?=\nDiagn[oó]sticos\s*\n|\nTratamientos\s*\n|$)/i);
  if (!match?.[1]) return [];

  const body = cleanEvolutionBody(match[1]);
  if (body.length < 40) return [];

  const dateFromText =
    normalized.match(/(\d{2}-[A-ZÁÉÍÓÚÑ]{3}-\d{2,4})/i)?.[1] ??
    normalized.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/)?.[1];
  const dateIso = dateFromText ? parseLegacyDateToken(dateFromText) : null;
  const consultationDate = dateIso ?? new Date().toISOString().slice(0, 10);
  const marker = `[Import:${consultationDate}]`;
  const professionalName =
    normalized.match(/\d{2}-[A-ZÁÉÍÓÚÑ]{3}-\d{2,4}\s+([^\n]+)/i)?.[1]?.trim() ?? "Profesional";

  return [
    {
      marker,
      consultationDate,
      professionalName,
      timeLabel: null,
      chief_complaint: `${marker} ${buildChiefComplaint(body, consultationDate)}`.slice(0, 600),
      evolution: body.slice(0, 12000),
      diagnosis: "",
      indications: extractSection(body, [
        /(?:Conducta(?: Médica)?|Plan(?: Terap[eé]utico)?)[:\s]*([\s\S]{10,4000})/i,
      ]).slice(0, 4000),
    },
  ];
}

export function parseLegacyClinicalEvolutionsWithFallback(
  text: string
): LegacyClinicalEvolutionEntry[] {
  const entries = parseLegacyClinicalEvolutions(text);
  if (entries.length > 0) return entries;
  return parseLegacyClinicalEvolutionsFallback(text);
}
