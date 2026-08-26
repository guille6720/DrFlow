/**
 * Parse CIE-10-ES tabular excerpt from data/lista-tabular-enfermedades.raw.txt
 * Source of truth: lista de enfermedades.pdf (CIE-10-ES 6ª ed. ene 2026, extracto).
 * Does NOT invent codes/names outside the PDF text.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const ROOT = process.cwd();
const RAW = path.join(ROOT, "data/lista-tabular-enfermedades.raw.txt");
const OUT_JSON = path.join(ROOT, "data/lista-tabular-enfermedades.normalized.json");
const OUT_REPORT = path.join(ROOT, "data/lista-tabular-enfermedades.validation-report.json");

/** ICD-10-CM style: A00, C7A, F01.A, F01.A11, O9A.1, etc. */
const CODE_TOKEN = "([A-Z][0-9][A-Z0-9](?:\\.[A-Z0-9]{1,4})?)";
const CODE_RE = new RegExp(`^(?:(\\dº)\\s+)?(?:\\+\\s+)?${CODE_TOKEN}\\s+(.+)$`, "i");

const CHAPTER_RE = /^\+?\s*CAPÍTULO\s+(\d+)\.\s+(.+)$/i;
const SECTION_RANGE_RE = /^(.+?)\s+\(([A-Z]\d{2}-[A-Z]\d{2})\)$/i;
const PAGE_CHAPTER_RE = /^(\d{3,4})\s+([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ\s,]+)$/;
const TOC_RANGE_RE = /^[A-Z][0-9][A-Z0-9]?-[A-Z][0-9][A-Z0-9]?\s+\S+/i;

const CHAPTER_BY_LETTER = {
  A: "CIERTAS ENFERMEDADES INFECCIOSAS Y PARASITARIAS",
  B: "CIERTAS ENFERMEDADES INFECCIOSAS Y PARASITARIAS",
  C: "NEOPLASIAS",
  D: "NEOPLASIAS / ENFERMEDADES DE LA SANGRE Y ÓRGANOS HEMATOPOYÉTICOS",
  E: "ENFERMEDADES ENDOCRINAS, NUTRICIONALES Y METABÓLICAS",
  F: "TRASTORNOS MENTALES, DEL COMPORTAMIENTO Y DEL NEURODESARROLLO",
  G: "ENFERMEDADES DEL SISTEMA NERVIOSO",
  H: "ENFERMEDADES DEL OJO Y SUS ANEXOS / OÍDO Y APÓFISIS MASTOIDES",
  I: "ENFERMEDADES DEL APARATO CIRCULATORIO",
  J: "ENFERMEDADES DEL APARATO RESPIRATORIO",
  K: "ENFERMEDADES DEL APARATO DIGESTIVO",
  L: "ENFERMEDADES DE LA PIEL Y DEL TEJIDO SUBCUTÁNEO",
  M: "ENFERMEDADES DEL APARATO MUSCULOESQUELÉTICO Y DEL TEJIDO CONECTIVO",
  N: "ENFERMEDADES DEL APARATO GENITOURINARIO",
  O: "EMBARAZO, PARTO Y PUERPERIO",
  P: "CIERTAS AFECCIONES ORIGINADAS EN EL PERIODO PERINATAL",
  Q: "MALFORMACIONES CONGÉNITAS, DEFORMIDADES Y ANOMALÍAS CROMOSÓMICAS",
  R: "SÍNTOMAS, SIGNOS Y RESULTADOS ANORMALES DE PRUEBAS CLÍNICAS Y DE LABORATORIO",
  S: "LESIONES TRAUMÁTICAS, ENVENENAMIENTOS Y OTRAS CONSECUENCIAS DE CAUSAS EXTERNAS",
  T: "LESIONES TRAUMÁTICAS, ENVENENAMIENTOS Y OTRAS CONSECUENCIAS DE CAUSAS EXTERNAS",
  U: "CÓDIGOS PARA PROPÓSITOS ESPECIALES",
  V: "CAUSAS EXTERNAS DE MORBILIDAD",
  W: "CAUSAS EXTERNAS DE MORBILIDAD",
  X: "CAUSAS EXTERNAS DE MORBILIDAD",
  Y: "CAUSAS EXTERNAS DE MORBILIDAD",
  Z: "FACTORES QUE INFLUYEN EN EL ESTADO DE SALUD Y CONTACTO CON LOS SERVICIOS DE SALUD",
};

const INSTRUCTION_START_RE =
  /^(incluye\s*:|excluye\s*:|utilice\b|codifique\b|nota\s*:|notas\s*:|use\b|este capítulo\b|cuando un problema\b|morfología\b|actividad funcional\b|todas las neoplasias\b|se puede utilizar\b|el capítulo\b|para neoplasias\b|una neoplasia\b|las neoplasias\b|neoplasias malignas\b|neoplasia maligna de tejido\b)/i;

function cleanSpaces(s) {
  return s.replace(/\t+/g, " ").replace(/[ \u00a0]+/g, " ").trim();
}

function fold(s) {
  return cleanSpaces(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parentCode(code) {
  if (!code.includes(".")) return null;
  const [base, rest] = code.split(".");
  if (rest.length <= 1) return base;
  return `${base}.${rest.slice(0, -1)}`;
}

function codeLevel(code) {
  if (!code.includes(".")) return 3;
  const rest = code.split(".")[1] ?? "";
  return 3 + rest.length;
}

function codeInRange(code, range) {
  if (!range) return true;
  const m = String(range).toUpperCase().match(/^([A-Z][0-9][A-Z0-9]?)-([A-Z][0-9][A-Z0-9]?)$/);
  if (!m) return true;
  const letter = code[0].toUpperCase();
  return letter >= m[1][0] && letter <= m[2][0];
}

function resolveCategory(code, chapter, chapterRange) {
  if (chapter && codeInRange(code, chapterRange)) return chapter;
  return CHAPTER_BY_LETTER[code[0].toUpperCase()] ?? chapter ?? null;
}

function endsIncomplete(text) {
  if (!text) return false;
  if (/[,;:\-–]$/.test(text)) return true;
  if (
    /\b(de|del|de la|de los|de las|a|al|en|con|por|para|sin|y|o|como|tanto|no|u|ni)\s*$/i.test(
      text
    )
  ) {
    return true;
  }
  return false;
}

function looksLikeProse(line) {
  if (line.length > 100) return true;
  if (
    /\b(como consecuencia|incluida la|clasific|deberá|sin embargo|para identificar|si procede|deberá clasific)\b/i.test(
      line
    )
  ) {
    return true;
  }
  if ((line.match(/,/g) || []).length >= 4) return true;
  return false;
}

function looksLikeSynonym(line) {
  if (!line || line.length < 2 || line.length > 90) return false;
  if (INSTRUCTION_START_RE.test(line)) return false;
  if (/^\dº\b/i.test(line)) return false;
  if (/^[A-Z][0-9][A-Z0-9]/i.test(line)) return false;
  if (/^x\s*7º/i.test(line)) return false;
  if (/^-\s/.test(line)) return false;
  if (/^[a-záéíóúñü]/.test(line)) return false;
  if (/^tales como/i.test(line) || /^asociadas como/i.test(line)) return false;
  if (looksLikeProse(line)) return false;
  // Trailing sentence period → note fragment, not synonym (allow NEOM)
  if (/\.\s*$/.test(line) && !/\bNEOM\.?\s*$/i.test(line)) return false;
  if ((line.match(/,/g) || []).length >= 2) return false;
  // Cross-ref inclusion: "diarrea (R19.7)"
  if (/\([A-Z][0-9][A-Z0-9.]*\)/.test(line)) return false;
  return true;
}

/**
 * Bare category codes in chapter TOC (no degree marker, no decimal) are skipped
 * while inChapterToc. Real tabular rows usually have 4º/5º/… or a dotted code.
 */
function isLikelyTabularCode(levelMarker, code) {
  if (levelMarker) return true;
  if (code.includes(".")) return true;
  // Category headers in tabular list sometimes appear as bare A00 with 4º —
  // without marker, only accept if not in TOC mode (caller checks).
  return true;
}

function normalizeRows(rawText) {
  const lines = rawText.split(/\r?\n/).map(cleanSpaces);
  /** @type {Array<Record<string, unknown>>} */
  const rows = [];
  /** @type {Array<Record<string, unknown>>} */
  const ambiguous = [];
  /** @type {Array<Record<string, unknown>>} */
  const skipped = [];

  let chapter = null;
  let chapterRange = null;
  let section = null;
  let sectionRange = null;
  let inInstruction = false;
  let inChapterToc = false;
  /** @type {null | { code: string, name: string, synonyms: string[], levelMarker: string | null, dagger: boolean, lastField: 'name' | 'synonym', skippedUnder: boolean }} */
  let current = null;

  function flush() {
    if (!current) return;
    let name = cleanSpaces(current.name);
    name = name.replace(/\s+(Utilice|Incluye|Excluye|Nota|Codifique)\b.*$/i, "").trim();
    // Collapse accidental double spaces from wraps
    name = name.replace(/\s{2,}/g, " ");
    if (!name) {
      ambiguous.push({ reason: "empty_name", code: current.code });
      current = null;
      return;
    }
    if (name.length > 180) {
      ambiguous.push({
        reason: "name_too_long",
        code: current.code,
        name: name.slice(0, 180),
      });
      const cut = name.slice(0, 140);
      const lastSpace = cut.lastIndexOf(" ");
      name = lastSpace > 40 ? cut.slice(0, lastSpace) : cut;
    }
    const code = current.code.toUpperCase();
    const synonyms = [];
    for (const s of current.synonyms.map(cleanSpaces).filter(Boolean)) {
      if (s.toLowerCase() === name.toLowerCase()) continue;
      if (s.length > 100 || looksLikeProse(s)) continue;
      if (/^\dº\b/i.test(s) || /^[A-Z][0-9][A-Z0-9]/i.test(s)) continue;
      synonyms.push(s);
    }
    rows.push({
      code,
      name,
      parent_code: parentCode(code),
      category: resolveCategory(code, chapter, chapterRange),
      subcategory: section && codeInRange(code, sectionRange) ? section : null,
      chapter_range: chapterRange && codeInRange(code, chapterRange) ? chapterRange : null,
      section_range: sectionRange && codeInRange(code, sectionRange) ? sectionRange : null,
      level: codeLevel(code),
      level_marker: current.levelMarker,
      dagger: current.dagger,
      synonyms: [...new Set(synonyms)],
      active: true,
      source: "cie10-es-lista-tabular-enfermedades-pdf",
      source_version: "CIE-10-ES 6a edicion enero 2026 (extracto PDF)",
    });
    current = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    if (/^LISTA\s+TABULAR/i.test(line) || /^--\s*\d+\s+of\s+\d+/i.test(line)) {
      flush();
      skipped.push({ reason: "page_chrome", line });
      inInstruction = false;
      continue;
    }
    if (/^\d{4}$/.test(line)) {
      skipped.push({ reason: "year_marker", line });
      continue;
    }

    if (/^este capítulo contiene/i.test(line)) {
      flush();
      inChapterToc = true;
      inInstruction = false;
      skipped.push({ reason: "chapter_toc_start", line });
      continue;
    }

    const chapterMatch = line.match(CHAPTER_RE);
    if (chapterMatch) {
      flush();
      inInstruction = false;
      inChapterToc = false;
      let title = cleanSpaces(chapterMatch[2]);
      let nextIdx = i;
      const rangeInline = title.match(/\(([A-Z]\d{2}-[A-Z]\d{2})\)$/i);
      if (rangeInline) {
        chapterRange = rangeInline[1].toUpperCase();
        title = cleanSpaces(title.replace(/\s*\([A-Z]\d{2}-[A-Z]\d{2}\)$/i, ""));
      } else {
        while (nextIdx + 1 < lines.length) {
          const next = lines[nextIdx + 1];
          if (!next || CODE_RE.test(next) || CHAPTER_RE.test(next)) break;
          const bareRange = next.match(/^\(([A-Z]\d{2}-[A-Z]\d{2})\)$/i);
          if (bareRange) {
            chapterRange = bareRange[1].toUpperCase();
            nextIdx += 1;
            break;
          }
          const nextRange = next.match(/^(.+?)\s*\(([A-Z]\d{2}-[A-Z]\d{2})\)$/i);
          if (nextRange) {
            title = cleanSpaces(`${title} ${nextRange[1]}`);
            chapterRange = nextRange[2].toUpperCase();
            nextIdx += 1;
            break;
          }
          if (next === next.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{3,}/.test(next) && !next.includes("(")) {
            title = cleanSpaces(`${title} ${next}`);
            nextIdx += 1;
            continue;
          }
          break;
        }
        i = nextIdx;
      }
      chapter = title;
      section = null;
      sectionRange = null;
      continue;
    }

    const pageChapter = line.match(PAGE_CHAPTER_RE);
    if (pageChapter && !CODE_RE.test(line)) {
      flush();
      inInstruction = false;
      inChapterToc = false;
      chapter = cleanSpaces(pageChapter[2]);
      chapterRange = null;
      section = null;
      sectionRange = null;
      skipped.push({ reason: "page_chapter_header", line });
      continue;
    }

    const sectionMatch = line.match(SECTION_RANGE_RE);
    if (
      sectionMatch &&
      !CODE_RE.test(line) &&
      /[A-ZÁÉÍÓÚÑ]{4,}/.test(sectionMatch[1]) &&
      sectionMatch[1] === sectionMatch[1].toUpperCase()
    ) {
      flush();
      inInstruction = false;
      inChapterToc = false;
      section = cleanSpaces(sectionMatch[1]);
      sectionRange = sectionMatch[2].toUpperCase();
      continue;
    }

    if (TOC_RANGE_RE.test(line) && !CODE_RE.test(line)) {
      flush();
      skipped.push({ reason: "toc_range", line });
      continue;
    }

    const codeMatch = line.match(CODE_RE);
    if (codeMatch) {
      const levelMarker = codeMatch[1] ?? null;
      const code = codeMatch[2];
      const title = cleanSpaces(codeMatch[3]);

      // Chapter TOC bare categories (C50 Title) — not tabular rows
      if (inChapterToc && !levelMarker && !code.includes(".")) {
        skipped.push({ reason: "toc_bare_code", line });
        continue;
      }

      if (!isLikelyTabularCode(levelMarker, code)) {
        skipped.push({ reason: "non_tabular_code", line });
        continue;
      }

      flush();
      inInstruction = false;
      // Leaving TOC when we see a real degree-marked or dotted code
      if (levelMarker || code.includes(".")) inChapterToc = false;

      const rest = line.replace(/^\dº\s+/, "");
      const dagger = /^\+/.test(rest);
      current = {
        code,
        name: title,
        synonyms: [],
        levelMarker,
        dagger,
        lastField: "name",
        skippedUnder: false,
      };
      continue;
    }

    if (INSTRUCTION_START_RE.test(line)) {
      flush();
      inInstruction = true;
      skipped.push({ reason: "instruction", line: line.slice(0, 120) });
      continue;
    }

    if (inInstruction || inChapterToc) {
      skipped.push({
        reason: inChapterToc ? "chapter_toc_body" : "instruction_body",
        line: line.slice(0, 120),
      });
      continue;
    }

    if (current) {
      const lowerStart = /^[a-záéíóúñü]/.test(line);
      if (
        current.lastField === "name" &&
        (endsIncomplete(current.name) || (lowerStart && !current.skippedUnder))
      ) {
        current.name = cleanSpaces(`${current.name} ${line}`);
        current.skippedUnder = false;
        continue;
      }
      if (current.lastField === "synonym" && current.synonyms.length > 0) {
        const last = current.synonyms[current.synonyms.length - 1];
        if (endsIncomplete(last) || lowerStart) {
          const joined = cleanSpaces(`${last} ${line}`);
          if (joined.length > 90 || looksLikeProse(joined)) {
            current.synonyms.pop();
            current.lastField = "name";
            current.skippedUnder = true;
            skipped.push({
              reason: "synonym_wrap_dropped",
              line: joined.slice(0, 120),
              code: current.code,
            });
          } else {
            current.synonyms[current.synonyms.length - 1] = joined;
            current.skippedUnder = false;
          }
          continue;
        }
      }
      if (looksLikeSynonym(line)) {
        current.synonyms.push(line);
        current.lastField = "synonym";
        current.skippedUnder = false;
        continue;
      }
      current.skippedUnder = true;
      skipped.push({
        reason: "non_synonym_under_code",
        line: line.slice(0, 120),
        code: current.code,
      });
      continue;
    }

    ambiguous.push({ reason: "orphan_text", line: line.slice(0, 160), index: i });
  }
  flush();

  const byCode = new Map();
  const duplicates = [];
  for (const row of rows) {
    const key = String(row.code);
    if (byCode.has(key)) {
      duplicates.push({ code: key, kept: byCode.get(key).name, duplicate: row.name });
      continue;
    }
    byCode.set(key, row);
  }

  return {
    rows: [...byCode.values()],
    duplicates,
    ambiguous,
    skipped,
    detectedBeforeDedupe: rows.length,
  };
}

function qualityFlags(rows) {
  const truncated = [];
  const instructionBleed = [];
  const longNames = [];
  const nestedInSyn = [];
  for (const row of rows) {
    const name = String(row.name);
    if (/\b(no|de|del|la|los|las|y|o|con|por|para|al|en)\s*$/i.test(name)) {
      truncated.push({ code: row.code, name });
    }
    if (/\b(utilice|incluye|excluye|este código|capítulo)\b/i.test(name)) {
      instructionBleed.push({ code: row.code, name: name.slice(0, 120) });
    }
    if (name.length > 140) longNames.push({ code: row.code, name: name.slice(0, 160) });
    if (row.synonyms.some((s) => /^\dº\b/i.test(s) || /^[A-Z][0-9][A-Z0-9]/i.test(s))) {
      nestedInSyn.push({ code: row.code, synonyms: row.synonyms.slice(0, 3) });
    }
  }
  return {
    truncated: truncated.slice(0, 30),
    truncated_count: truncated.length,
    instructionBleed,
    longNames: longNames.slice(0, 20),
    longNames_count: longNames.length,
    nestedInSyn,
  };
}

function sampleValidate(rows, rawText) {
  const foldedRaw = fold(rawText);
  const compactRaw = foldedRaw.replace(/\s+/g, "");
  const checks = [];
  const pick = (arr) => arr.map((r) => ({ code: r.code, name: r.name }));
  const first20 = rows.slice(0, 20);
  const mid = Math.max(0, Math.floor(rows.length / 2) - 10);
  const mid20 = rows.slice(mid, mid + 20);
  const last20 = rows.slice(-20);
  const random50 = [];
  const used = new Set();
  let seed = 42;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  while (random50.length < Math.min(50, rows.length)) {
    const idx = Math.floor(rnd() * rows.length);
    if (used.has(idx)) continue;
    used.add(idx);
    random50.push(rows[idx]);
  }

  function presentInSource(row) {
    const code = String(row.code).toUpperCase();
    const codeOk =
      foldedRaw.includes(fold(code)) || compactRaw.includes(fold(code).replace(/\./g, ""));
    const tokens = fold(String(row.name))
      .split(/\s+/)
      .filter((t) => t.length > 2)
      .slice(0, 4);
    const nameOk =
      tokens.length === 0
        ? false
        : tokens.every((t) => foldedRaw.includes(t)) ||
          foldedRaw.includes(tokens.slice(0, 2).join(" "));
    return { codeOk, nameOk };
  }

  for (const [label, set] of [
    ["first20", first20],
    ["middle20", mid20],
    ["last20", last20],
    ["random50", random50],
  ]) {
    let fail = 0;
    const failures = [];
    for (const row of set) {
      const v = presentInSource(row);
      if (!v.codeOk || !v.nameOk) {
        fail += 1;
        if (failures.length < 8) failures.push({ ...row, ...v });
      }
    }
    checks.push({ label, count: set.length, fail, failures, sample: pick(set).slice(0, 5) });
  }
  return checks;
}

const raw = fs.readFileSync(RAW, "utf8");
const parsed = normalizeRows(raw);
const validation = sampleValidate(parsed.rows, raw);
const flags = qualityFlags(parsed.rows);
const emptyNames = parsed.rows.filter((r) => !String(r.name).trim());
const emptyCodes = parsed.rows.filter((r) => !String(r.code).trim());
const longNameFlags = parsed.ambiguous.filter((a) => a.reason === "name_too_long");

const report = {
  source_file: "lista de enfermedades.pdf",
  source_title:
    "CIE-10-ES. Clasificación Internacional de Enfermedades - 10.ª Revisión - Modificación Clínica. Sexta edición- enero 2026. Tomo I: Diagnósticos.pdf",
  note: "El PDF adjunto es un EXTRACTO tabular (23 páginas), no el Tomo I completo. Solo se importan diagnósticos presentes en este archivo.",
  pages: 23,
  raw_chars: raw.length,
  detected_before_dedupe: parsed.detectedBeforeDedupe,
  valid_diagnoses: parsed.rows.length,
  duplicates: parsed.duplicates.length,
  duplicate_samples: parsed.duplicates.slice(0, 20),
  empty_descriptions: emptyNames.length,
  empty_codes: emptyCodes.length,
  ambiguous: parsed.ambiguous.length,
  ambiguous_samples: parsed.ambiguous.slice(0, 40),
  name_too_long: longNameFlags.length,
  skipped_count: parsed.skipped.length,
  quality_flags: flags,
  sample_validation: validation,
  content_hash: createHash("sha256").update(JSON.stringify(parsed.rows)).digest("hex"),
};

fs.writeFileSync(OUT_JSON, JSON.stringify({ meta: report, diagnoses: parsed.rows }, null, 2), "utf8");
fs.writeFileSync(OUT_REPORT, JSON.stringify(report, null, 2), "utf8");

const failedSamples = validation.reduce((n, c) => n + c.fail, 0);
console.log(
  JSON.stringify(
    {
      valid: report.valid_diagnoses,
      duplicates: report.duplicates,
      ambiguous: report.ambiguous,
      name_too_long: longNameFlags.length,
      empty_descriptions: report.empty_descriptions,
      sample_failures: failedSamples,
      truncated_names: flags.truncated_count,
      long_names: flags.longNames_count,
      nested_in_syn: flags.nestedInSyn.length,
      instruction_bleed: flags.instructionBleed.length,
      out_json: OUT_JSON,
      out_report: OUT_REPORT,
    },
    null,
    2
  )
);

if (
  failedSamples > 5 ||
  emptyNames.length > 0 ||
  flags.truncated_count > 20 ||
  flags.instructionBleed.length > 0 ||
  flags.nestedInSyn.length > 0 ||
  flags.longNames_count > 15 ||
  longNameFlags.length > 15
) {
  console.error("VALIDATION_QUESTIONABLE");
  process.exitCode = 2;
} else {
  console.log("VALIDATION_OK");
}
