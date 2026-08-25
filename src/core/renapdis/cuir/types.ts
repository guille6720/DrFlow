/**
 * CUIR (Código Único de Identificación de Receta) — Phase 2 model.
 *
 * Six official structural components (DNSISA / ReNaPDiS).
 * Platform + repository IDs are assigned by DNSISA — DrFlow must NOT invent production values.
 */

export const CUIR_STATUSES = ["sandbox", "pending_official_ids", "official"] as const;
export type CuirStatus = (typeof CUIR_STATUSES)[number];

export type CuirComponents = {
  /** 1 — prescribing platform identifier (DNSISA-assigned) */
  platformId: string;
  /** 2 — repository identifier (DNSISA-assigned) */
  repositoryId: string;
  /** 3 — professional-license jurisdiction */
  jurisdiction: string;
  /** 4 — prescription type/subtype code */
  typeSubtype: string;
  /** 5 — unique prescription group identifier */
  groupId: string;
  /** 6 — item number within the group */
  itemNumber: string;
};

export type CuirValidationIssue = {
  code:
    | "missing_platform_id"
    | "missing_repository_id"
    | "missing_jurisdiction"
    | "missing_type_subtype"
    | "missing_group_id"
    | "missing_item_number"
    | "official_ids_absent"
    | "malformed";
  message: string;
};

export type CuirValidationResult =
  | { ok: true; status: CuirStatus; components: CuirComponents; formatted: string }
  | { ok: false; status: CuirStatus; issues: CuirValidationIssue[]; error: string };

/** Staging-only placeholders — never treat as legal/official. */
export const SANDBOX_CUIR_PLATFORM_PLACEHOLDER = "SBX-PLATFORM";
export const SANDBOX_CUIR_REPOSITORY_PLACEHOLDER = "SBX-REPO";

export function isCuirStatus(value: unknown): value is CuirStatus {
  return typeof value === "string" && (CUIR_STATUSES as readonly string[]).includes(value);
}

export function formatCuir(components: CuirComponents): string {
  return [
    components.platformId.trim(),
    components.repositoryId.trim(),
    components.jurisdiction.trim(),
    components.typeSubtype.trim(),
    components.groupId.trim(),
    components.itemNumber.trim(),
  ].join("|");
}

export function parseCuir(value: string): CuirComponents | null {
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

export function validateCuirComponents(input: {
  components: Partial<CuirComponents>;
  status: CuirStatus;
}): CuirValidationResult {
  const issues: CuirValidationIssue[] = [];
  const c = input.components;

  const requireField = (
    key: keyof CuirComponents,
    code: CuirValidationIssue["code"],
    label: string
  ) => {
    if (!c[key]?.trim()) {
      issues.push({ code, message: `Falta componente CUIR: ${label}.` });
    }
  };

  requireField("platformId", "missing_platform_id", "identificador de plataforma");
  requireField("repositoryId", "missing_repository_id", "identificador de repositorio");
  requireField("jurisdiction", "missing_jurisdiction", "jurisdicción de matrícula");
  requireField("typeSubtype", "missing_type_subtype", "tipo/subtipo");
  requireField("groupId", "missing_group_id", "identificador de grupo");
  requireField("itemNumber", "missing_item_number", "número de ítem");

  if (issues.length > 0) {
    return {
      ok: false,
      status: input.status,
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

  if (input.status === "official") {
    if (
      components.platformId === SANDBOX_CUIR_PLATFORM_PLACEHOLDER ||
      components.repositoryId === SANDBOX_CUIR_REPOSITORY_PLACEHOLDER ||
      components.platformId.startsWith("SBX") ||
      components.repositoryId.startsWith("SBX")
    ) {
      return {
        ok: false,
        status: input.status,
        issues: [
          {
            code: "official_ids_absent",
            message:
              "No se pueden usar placeholders sandbox como CUIR oficial. Faltan IDs DNSISA.",
          },
        ],
        error: "Identificadores oficiales DNSISA ausentes.",
      };
    }
  }

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

  return {
    ok: true,
    status: input.status,
    components,
    formatted: formatCuir(components),
  };
}

/**
 * Build a staging sandbox CUIR for QA only.
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

export function resolveCuirEnvironment(options?: {
  officialPlatformId?: string | null;
  officialRepositoryId?: string | null;
  allowSandbox?: boolean;
}): CuirStatus {
  const platform = options?.officialPlatformId?.trim();
  const repo = options?.officialRepositoryId?.trim();
  if (platform && repo && !platform.startsWith("SBX") && !repo.startsWith("SBX")) {
    return "official";
  }
  if (options?.allowSandbox) return "sandbox";
  return "pending_official_ids";
}
