/**
 * CUIR (Código Único de Identificación de Receta) — Phase 2.
 *
 * Official format (Resolución 2214/2025, Anexo IV): six numeric modules
 * concatenated with NO separators.
 *
 * Sandbox/debug uses a separate delimited representation and must never be
 * treated as a legal CUIR.
 *
 * Platform (M1) + repository (M2) IDs are assigned by DNSISA — NexClinic must NOT invent them.
 */

export const CUIR_STATUSES = ["sandbox", "pending_official_ids", "official"] as const;
export type CuirStatus = (typeof CUIR_STATUSES)[number];

/**
 * Structural components. For official mode each field must be numeric with
 * the lengths defined in Anexo IV. Sandbox may use descriptive placeholders.
 */
export type CuirComponents = {
  /** M1 — platform id (official: exactly 4 digits, DNSISA-assigned) */
  platformId: string;
  /** M2 — repository id (official: exactly 4 digits, DNSISA-assigned) */
  repositoryId: string;
  /** M3 — jurisdiction (official: exactly 2-digit INDEC code) */
  jurisdiction: string;
  /** M4 — type/subtype (official: exactly 4 digits, regulatory mapping) */
  typeSubtype: string;
  /** M5 — unique group id (official: numeric, 1–25 digits) */
  groupId: string;
  /** M6 — item number (official: exactly 2 digits, e.g. 1 → 01) */
  itemNumber: string;
};

export type CuirValidationIssueCode =
  | "missing_platform_id"
  | "missing_repository_id"
  | "missing_jurisdiction"
  | "missing_type_subtype"
  | "missing_group_id"
  | "missing_item_number"
  | "official_ids_absent"
  | "invalid_m1_length"
  | "invalid_m2_length"
  | "invalid_m3_length"
  | "invalid_m4_length"
  | "invalid_m5_length"
  | "invalid_m6_length"
  | "non_numeric"
  | "sandbox_placeholder"
  | "separator_present"
  | "m4_mapping_pending"
  | "malformed";

export type CuirValidationIssue = {
  code: CuirValidationIssueCode;
  message: string;
};

export type CuirValidationResult =
  | { ok: true; status: CuirStatus; components: CuirComponents; formatted: string }
  | { ok: false; status: CuirStatus; issues: CuirValidationIssue[]; error: string };

/** Staging-only placeholders — never treat as legal/official. */
export const SANDBOX_CUIR_PLATFORM_PLACEHOLDER = "SBX-PLATFORM";
export const SANDBOX_CUIR_REPOSITORY_PLACEHOLDER = "SBX-REPO";

export const OFFICIAL_CUIR_M1_LENGTH = 4;
export const OFFICIAL_CUIR_M2_LENGTH = 4;
export const OFFICIAL_CUIR_M3_LENGTH = 2;
export const OFFICIAL_CUIR_M4_LENGTH = 4;
export const OFFICIAL_CUIR_M5_MAX_LENGTH = 25;
export const OFFICIAL_CUIR_M6_LENGTH = 2;
export const OFFICIAL_CUIR_MIN_LENGTH =
  OFFICIAL_CUIR_M1_LENGTH +
  OFFICIAL_CUIR_M2_LENGTH +
  OFFICIAL_CUIR_M3_LENGTH +
  OFFICIAL_CUIR_M4_LENGTH +
  1 +
  OFFICIAL_CUIR_M6_LENGTH;
export const OFFICIAL_CUIR_MAX_LENGTH =
  OFFICIAL_CUIR_M1_LENGTH +
  OFFICIAL_CUIR_M2_LENGTH +
  OFFICIAL_CUIR_M3_LENGTH +
  OFFICIAL_CUIR_M4_LENGTH +
  OFFICIAL_CUIR_M5_MAX_LENGTH +
  OFFICIAL_CUIR_M6_LENGTH;

/**
 * Human-readable jurisdiction labels → official INDEC 2-digit codes.
 * Codes are public INDEC identifiers (not DNSISA platform IDs).
 * Incomplete list is intentional — unmapped labels stay pending for official CUIR.
 */
export const INDEC_JURISDICTION_CODES = {
  CABA: "02",
  "CIUDAD AUTONOMA DE BUENOS AIRES": "02",
  "BUENOS AIRES": "06",
  CATAMARCA: "10",
  CORDOBA: "14",
  CORRIENTES: "18",
  CHACO: "22",
  CHUBUT: "26",
  ENTRE_RIOS: "30",
  "ENTRE RIOS": "30",
  FORMOSA: "34",
  JUJUY: "38",
  "LA PAMPA": "42",
  "LA RIOJA": "46",
  MENDOZA: "50",
  MISIONES: "54",
  NEUQUEN: "58",
  "RIO NEGRO": "62",
  SALTA: "66",
  "SAN JUAN": "70",
  "SAN LUIS": "74",
  "SANTA CRUZ": "78",
  "SANTA FE": "82",
  "SANTIAGO DEL ESTERO": "86",
  TUCUMAN: "90",
  "TIERRA DEL FUEGO": "94",
} as const;

/**
 * Official M4 (type/subtype) registry — replaceable.
 * Intentionally empty until mappings from the published regulation are
 * confidently implemented. Do NOT invent codes.
 */
export const OFFICIAL_M4_TYPE_SUBTYPE_CODES: Readonly<Record<string, string>> = Object.freeze({});

export function isCuirStatus(value: unknown): value is CuirStatus {
  return typeof value === "string" && (CUIR_STATUSES as readonly string[]).includes(value);
}

function digitsOnly(value: string): string {
  return value.replace(/\D+/g, "");
}

function isAllDigits(value: string): boolean {
  return /^\d+$/.test(value);
}

function looksLikeSandboxPlaceholder(value: string): boolean {
  const v = value.trim().toUpperCase();
  return (
    v.startsWith("SBX") ||
    v === SANDBOX_CUIR_PLATFORM_PLACEHOLDER ||
    v === SANDBOX_CUIR_REPOSITORY_PLACEHOLDER ||
    /[A-Z]/.test(v)
  );
}

/** Pad item number for official M6 (1 → 01). */
export function serializeOfficialItemNumber(itemNumber: string | number): string | null {
  const raw = String(itemNumber).trim();
  if (!raw) return null;
  const digits = digitsOnly(raw);
  if (!digits || digits.length > OFFICIAL_CUIR_M6_LENGTH) return null;
  if (!isAllDigits(digits)) return null;
  return digits.padStart(OFFICIAL_CUIR_M6_LENGTH, "0");
}

/**
 * Resolve a human jurisdiction label or code to an official 2-digit INDEC code.
 * Returns null when not confidently mapped (official CUIR stays pending).
 */
export function resolveIndecJurisdictionCode(
  jurisdiction: string | null | undefined
): string | null {
  const raw = (jurisdiction ?? "").trim();
  if (!raw) return null;
  if (/^\d{2}$/.test(raw)) return raw;
  const key = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  const mapped = (INDEC_JURISDICTION_CODES as Record<string, string>)[key];
  return mapped ?? null;
}

/**
 * Resolve NexClinic category:subtype (or legacy keys) to official M4.
 * Returns null when mapping is not yet implemented from the published regulation.
 */
export function resolveOfficialTypeSubtypeCode(
  typeSubtype: string | null | undefined
): string | null {
  const raw = (typeSubtype ?? "").trim();
  if (!raw) return null;
  if (/^\d{4}$/.test(raw)) return raw;
  const mapped = OFFICIAL_M4_TYPE_SUBTYPE_CODES[raw];
  return mapped ?? null;
}

/**
 * Official CUIR serialization: direct concatenation, no separators.
 * Caller must pass already-validated official components.
 */
export function formatOfficialCuir(components: CuirComponents): string {
  const item = serializeOfficialItemNumber(components.itemNumber) ?? components.itemNumber;
  return [
    components.platformId,
    components.repositoryId,
    components.jurisdiction,
    components.typeSubtype,
    components.groupId,
    item,
  ].join("");
}

/**
 * Parse an official numeric CUIR (Anexo IV).
 * Returns null if separators, letters, or invalid lengths are present.
 */
export function parseOfficialCuir(value: string): CuirComponents | null {
  const raw = value.trim();
  if (!raw || /[^0-9]/.test(raw)) return null;
  if (raw.length < OFFICIAL_CUIR_MIN_LENGTH || raw.length > OFFICIAL_CUIR_MAX_LENGTH) {
    return null;
  }

  const platformId = raw.slice(0, 4);
  const repositoryId = raw.slice(4, 8);
  const jurisdiction = raw.slice(8, 10);
  const typeSubtype = raw.slice(10, 14);
  const itemNumber = raw.slice(-2);
  const groupId = raw.slice(14, -2);

  if (
    platformId.length !== 4 ||
    repositoryId.length !== 4 ||
    jurisdiction.length !== 2 ||
    typeSubtype.length !== 4 ||
    itemNumber.length !== 2 ||
    groupId.length < 1 ||
    groupId.length > OFFICIAL_CUIR_M5_MAX_LENGTH
  ) {
    return null;
  }

  return {
    platformId,
    repositoryId,
    jurisdiction,
    typeSubtype,
    groupId,
    itemNumber,
  };
}

export function validateOfficialCuirComponents(input: {
  components: Partial<CuirComponents>;
}): CuirValidationResult {
  const issues: CuirValidationIssue[] = [];
  const c = input.components;

  const push = (code: CuirValidationIssueCode, message: string) => {
    issues.push({ code, message });
  };

  const platformId = c.platformId?.trim() ?? "";
  const repositoryId = c.repositoryId?.trim() ?? "";
  const jurisdictionRaw = c.jurisdiction?.trim() ?? "";
  const typeSubtypeRaw = c.typeSubtype?.trim() ?? "";
  const groupId = c.groupId?.trim() ?? "";
  const itemRaw = c.itemNumber?.trim() ?? "";

  if (!platformId) push("missing_platform_id", "Falta M1 (plataforma DNSISA).");
  if (!repositoryId) push("missing_repository_id", "Falta M2 (repositorio DNSISA).");
  if (!jurisdictionRaw) push("missing_jurisdiction", "Falta M3 (jurisdicción INDEC).");
  if (!typeSubtypeRaw) push("missing_type_subtype", "Falta M4 (tipo/subtipo).");
  if (!groupId) push("missing_group_id", "Falta M5 (grupo de receta).");
  if (!itemRaw) push("missing_item_number", "Falta M6 (número de ítem).");

  if (
    platformId === SANDBOX_CUIR_PLATFORM_PLACEHOLDER ||
    repositoryId === SANDBOX_CUIR_REPOSITORY_PLACEHOLDER ||
    platformId.toUpperCase().startsWith("SBX") ||
    repositoryId.toUpperCase().startsWith("SBX")
  ) {
    push("official_ids_absent", "Faltan identificadores oficiales DNSISA (no usar SBX).");
  }

  if (platformId.includes("|") || repositoryId.includes("|") || groupId.includes("|")) {
    push("separator_present", "Los módulos oficiales no pueden contener separadores.");
  }

  if (platformId && (!isAllDigits(platformId) || platformId.length !== OFFICIAL_CUIR_M1_LENGTH)) {
    push("invalid_m1_length", "M1 debe ser numérico de exactamente 4 dígitos.");
  }
  if (
    repositoryId &&
    (!isAllDigits(repositoryId) || repositoryId.length !== OFFICIAL_CUIR_M2_LENGTH)
  ) {
    push("invalid_m2_length", "M2 debe ser numérico de exactamente 4 dígitos.");
  }

  const jurisdiction = resolveIndecJurisdictionCode(jurisdictionRaw);
  if (jurisdictionRaw && !jurisdiction) {
    push(
      "invalid_m3_length",
      "M3 debe ser el código INDEC numérico de exactamente 2 dígitos (no etiquetas sin mapeo)."
    );
  }

  const typeSubtype =
    resolveOfficialTypeSubtypeCode(typeSubtypeRaw) ??
    (/^\d{4}$/.test(typeSubtypeRaw) ? typeSubtypeRaw : null);
  if (typeSubtypeRaw && !typeSubtype) {
    push(
      "m4_mapping_pending",
      "M4 aún no tiene mapeo regulatorio implementado para este tipo/subtipo. Receta pendiente."
    );
  }

  if (groupId && (!isAllDigits(groupId) || groupId.length > OFFICIAL_CUIR_M5_MAX_LENGTH)) {
    push("invalid_m5_length", "M5 debe ser numérico de como máximo 25 dígitos.");
  }
  if (groupId && /[A-Za-z]/.test(groupId)) {
    push("non_numeric", "M5 no puede contener caracteres alfabéticos.");
  }

  const itemNumber = serializeOfficialItemNumber(itemRaw);
  if (itemRaw && !itemNumber) {
    push("invalid_m6_length", "M6 debe ser numérico y serializarse en exactamente 2 dígitos (ej. 01).");
  }

  if (issues.length > 0) {
    return {
      ok: false,
      status: "official",
      issues,
      error: issues.map((i) => i.message).join(" "),
    };
  }

  const components: CuirComponents = {
    platformId,
    repositoryId,
    jurisdiction: jurisdiction!,
    typeSubtype: typeSubtype!,
    groupId,
    itemNumber: itemNumber!,
  };

  return {
    ok: true,
    status: "official",
    components,
    formatted: formatOfficialCuir(components),
  };
}

/**
 * Internal/debug sandbox representation — NOT the official CUIR.
 * Uses "|" only for human QA; never display as legally valid.
 */
export function formatSandboxCuirDebug(components: CuirComponents): string {
  return [
    components.platformId.trim(),
    components.repositoryId.trim(),
    components.jurisdiction.trim(),
    components.typeSubtype.trim(),
    components.groupId.trim(),
    components.itemNumber.trim(),
  ].join("|");
}

export function parseSandboxCuirDebug(value: string): CuirComponents | null {
  const parts = value.trim().split("|").map((p) => p.trim());
  if (parts.length !== 6 || parts.some((p) => !p)) return null;
  return {
    platformId: parts[0],
    repositoryId: parts[1],
    jurisdiction: parts[2],
    typeSubtype: parts[3],
    groupId: parts[4],
    itemNumber: parts[5],
  };
}

/** Reject pipe-delimited (or any non-digit) strings as official CUIR. */
export function isOfficialCuirString(value: string): boolean {
  return parseOfficialCuir(value) !== null;
}

/**
 * Validate components for the requested environment.
 * Official path uses strict Anexo IV rules; sandbox only checks presence.
 */
export function validateCuirComponents(input: {
  components: Partial<CuirComponents>;
  status: CuirStatus;
}): CuirValidationResult {
  if (input.status === "pending_official_ids") {
    return {
      ok: false,
      status: input.status,
      issues: [
        {
          code: "official_ids_absent",
          message:
            "CUIR pendiente de identificadores oficiales de plataforma/repositorio (DNSISA).",
        },
      ],
      error: "CUIR pendiente de IDs oficiales.",
    };
  }

  if (input.status === "official") {
    return validateOfficialCuirComponents({ components: input.components });
  }

  // sandbox
  const issues: CuirValidationIssue[] = [];
  const c = input.components;
  const requireField = (
    key: keyof CuirComponents,
    code: CuirValidationIssueCode,
    label: string
  ) => {
    if (!c[key]?.trim()) {
      issues.push({ code, message: `Falta componente CUIR sandbox: ${label}.` });
    }
  };
  requireField("platformId", "missing_platform_id", "plataforma");
  requireField("repositoryId", "missing_repository_id", "repositorio");
  requireField("jurisdiction", "missing_jurisdiction", "jurisdicción");
  requireField("typeSubtype", "missing_type_subtype", "tipo/subtipo");
  requireField("groupId", "missing_group_id", "grupo");
  requireField("itemNumber", "missing_item_number", "ítem");

  if (issues.length > 0) {
    return {
      ok: false,
      status: "sandbox",
      issues,
      error: issues.map((i) => i.message).join(" "),
    };
  }

  const components: CuirComponents = {
    platformId: c.platformId!.trim(),
    repositoryId: c.repositoryId!.trim(),
    jurisdiction: c.jurisdiction!.trim(),
    typeSubtype: c.typeSubtype!.trim(),
    groupId: c.groupId!.trim(),
    itemNumber: c.itemNumber!.trim(),
  };

  return {
    ok: true,
    status: "sandbox",
    components,
    formatted: formatSandboxCuirDebug(components),
  };
}

/**
 * @deprecated Use formatSandboxCuirDebug or formatOfficialCuir explicitly.
 * Kept as sandbox debug alias so callers do not accidentally treat "|" as official.
 */
export function formatCuir(components: CuirComponents): string {
  return formatSandboxCuirDebug(components);
}

/**
 * @deprecated Use parseOfficialCuir or parseSandboxCuirDebug explicitly.
 */
export function parseCuir(value: string): CuirComponents | null {
  if (value.includes("|")) return parseSandboxCuirDebug(value);
  return parseOfficialCuir(value);
}

/**
 * Build staging sandbox components for QA only.
 * Callers MUST mark status=sandbox and never claim legal validity.
 */
export function buildSandboxCuirComponents(input: {
  jurisdiction: string;
  typeSubtype: string;
  groupId: string;
  itemNumber?: string;
}): CuirComponents {
  return {
    platformId: SANDBOX_CUIR_PLATFORM_PLACEHOLDER,
    repositoryId: SANDBOX_CUIR_REPOSITORY_PLACEHOLDER,
    jurisdiction: input.jurisdiction.trim() || "XX",
    typeSubtype: input.typeSubtype.trim() || "MED",
    groupId: input.groupId.trim(),
    itemNumber: (input.itemNumber ?? "1").trim(),
  };
}

/**
 * Official mode requires real DNSISA numeric M1/M2 (exactly 4 digits each).
 * Alphabetic / SBX values never unlock official mode.
 */
export function resolveCuirEnvironment(options?: {
  officialPlatformId?: string | null;
  officialRepositoryId?: string | null;
  allowSandbox?: boolean;
}): CuirStatus {
  const platform = options?.officialPlatformId?.trim() ?? "";
  const repo = options?.officialRepositoryId?.trim() ?? "";
  const platformOk =
    isAllDigits(platform) &&
    platform.length === OFFICIAL_CUIR_M1_LENGTH &&
    !looksLikeSandboxPlaceholder(platform);
  const repoOk =
    isAllDigits(repo) &&
    repo.length === OFFICIAL_CUIR_M2_LENGTH &&
    !looksLikeSandboxPlaceholder(repo);
  if (platformOk && repoOk) return "official";
  if (options?.allowSandbox) return "sandbox";
  return "pending_official_ids";
}
