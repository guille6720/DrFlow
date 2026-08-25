import {
  isKnownRpcErrorCode,
  RPC_USER_MESSAGES,
  type RpcErrorCode,
} from "@/core/errors/rpc-error-messages";

/** Official PostgreSQL SQLSTATE codes used by DrFlow. */
export const PG_ERROR_CODES = {
  UNIQUE_VIOLATION: "23505",
  CHECK_VIOLATION: "23514",
  RAISE_EXCEPTION: "P0001",
  UNDEFINED_COLUMN: "42703",
  UNDEFINED_FUNCTION: "42883",
  UNDEFINED_TABLE: "42P01",
} as const;

export type PgErrorCode = (typeof PG_ERROR_CODES)[keyof typeof PG_ERROR_CODES];

export type PostgresErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export type ParsedPostgresError = {
  pgCode: string | undefined;
  message: string;
  details: string | undefined;
  hint: string | undefined;
  rpcCode: RpcErrorCode | undefined;
  undefinedFunctionName: string | undefined;
  missingColumnKey: string | undefined;
  undefinedRelationName: string | undefined;
  checkConstraintName: string | undefined;
};

const RPC_CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,}$/;

const FUNCTION_MIGRATION_HINTS: Record<string, string> = {
  accept_clinic_invitations_for_user: "Ejecutá la migración 018 en Supabase SQL Editor.",
  delete_own_account:
    "Ejecutá la migración 039/093 en Supabase SQL Editor (delete_own_account) y volvé a intentar.",
  remove_clinic_member_user:
    "Ejecutá las migraciones 035 y 036 en Supabase SQL Editor y volvé a intentar.",
  seed_demo_patients_for_clinic:
    "Falta la función en Supabase. Ejecutá las migraciones 017 y 019 en el SQL Editor.",
  seed_pami_cabecera_for_clinic:
    "Ejecutá la migración 020 en Supabase SQL Editor (020_pami_cabecera.sql).",
  setup_user_clinic:
    "Falta ejecutar la migración 024 en Supabase SQL Editor (supabase/migrations/024_doctor_onboarding_fields.sql).",
  create_clinical_record_atomic:
    "No se pudo guardar la consulta: la función en Supabase está desactualizada. Ejecutá las migraciones 110 y 111 en el SQL Editor y después: NOTIFY pgrst, 'reload schema';",
  create_staff_appointment_atomic:
    "No se pudo crear el turno: falta o está desactualizada la función en Supabase. Ejecutá la migración 084 en el SQL Editor y después: NOTIFY pgrst, 'reload schema';",
  update_clinical_record_atomic:
    "No se pudo actualizar la consulta: la función en Supabase está desactualizada. Ejecutá las migraciones 110 y 111 en el SQL Editor y después: NOTIFY pgrst, 'reload schema';",
  get_clinic_entitlements:
    "Falta la migración 121 en Supabase (entitlements comerciales).",
  increment_feature_usage:
    "Falta la migración 121 en Supabase (increment_feature_usage).",
  try_consume_feature_usage:
    "Falta la migración 121 en Supabase (try_consume_feature_usage).",
  assign_clinic_entitlement_plan:
    "Falta la migración 122 en Supabase (asignación comercial de planes).",
  upsert_clinic_feature_override:
    "Falta la migración 122 en Supabase (overrides comerciales).",
  get_clinic_entitlement_usage:
    "Falta la migración 124 en Supabase (uso comercial medido).",
  set_clinic_entitlement_status:
    "Falta la migración 124/125 en Supabase (estado comercial).",
  clinic_current_entitlement_subscription_id:
    "Falta la migración 125 en Supabase (suscripción comercial vigente).",
  entitlement_metered_commercially_blocked:
    "Falta la migración 126 en Supabase (pausa de consumo medido).",
  clear_clinic_feature_override:
    "Falta la migración 126 en Supabase (quitar override comercial).",
  set_clinic_entitlement_trial_end:
    "Falta la migración 127 en Supabase (ventana de prueba comercial).",
  entitlement_subscription_is_live:
    "Falta la migración 127 en Supabase (trial comercial vigente).",
  expire_lapsed_clinic_entitlement_trials:
    "Falta la migración 128 en Supabase (expirar trial comercial vencido).",
};

const TABLE_MIGRATION_HINTS: Record<string, string> = {
  clinic_invitations: "Ejecutá la migración 018 en Supabase SQL Editor.",
};

const COLUMN_MIGRATION_HINTS: Record<string, string> = {
  "medical_orders.idempotency_key":
    "Falta la migración 076 en Supabase (idempotency_key en medical_orders).",
  "medical_orders.version": "Falta la migración 074 en Supabase (version en medical_orders).",
  "patients.insurance_plan":
    "Falta actualizar la base de datos (columna insurance_plan). En Supabase → SQL Editor ejecutá supabase/migrations/041_patients_insurance_plan.sql y volvé a intentar.",
  "appointments.cancellation_category":
    "Falta la migración 085 en Supabase. Ejecutá supabase/scripts/prod-fix-appointment-cancellation.sql y volvé a intentar.",
  "prescription_drafts.diagnosis_cie10":
    "Falta la migración de recetas en Supabase. Ejecutá en el SQL Editor el archivo supabase/migrations/014_repair_prescription_schema.sql (o 013) y volvé a intentar.",
  "prescription_drafts.prescription_type":
    "Falta la migración de recetas en Supabase. Ejecutá en el SQL Editor el archivo supabase/migrations/014_repair_prescription_schema.sql (o 013) y volvé a intentar.",
};

const CHECK_CONSTRAINT_HINTS: Record<string, string> = {
  user_ai_connections_provider_check:
    "Gemini todavía no está habilitado en la base de datos. Un administrador debe aplicar la migración 069 en Supabase (ver instrucciones abajo).",
};

const SCHEMA_CACHE_HINTS: Record<string, string> = {
  medical_orders:
    "Falta la migración 015 en Supabase (órdenes médicas y turnos online).",
  "schema cache":
    "Falta la migración 015 en Supabase (órdenes médicas y turnos online).",
  "function update_updated_at() does not exist":
    "Falta la función update_updated_at (migración 001).",
};

function trimOrUndefined(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function extractRpcCodeCandidate(value: string | undefined): RpcErrorCode | undefined {
  if (!value || !RPC_CODE_PATTERN.test(value)) return undefined;
  return isKnownRpcErrorCode(value) ? value : undefined;
}

/** Extracts a missing column key as `table.column` when PostgreSQL reports 42703. */
export function extractMissingColumnKey(message: string): string | undefined {
  const quoted = message.match(
    /column "([^"]+)" of relation "([^"]+)" does not exist/i
  );
  if (quoted) {
    return `${quoted[2]}.${quoted[1]}`;
  }

  const unquoted = message.match(/column (\S+\.\S+) does not exist/i);
  if (unquoted) {
    return unquoted[1];
  }

  return undefined;
}

/** Extracts the function name from PostgreSQL undefined_function (42883) errors. */
export function extractUndefinedFunctionName(message: string): string | undefined {
  const postgrest = message.match(
    /function (?:public\.)?([a-z0-9_]+)\s*\(/i
  );
  if (postgrest?.[1] && postgrest[1] !== "public") return postgrest[1];

  const cache = message.match(
    /could not find the function (?:public\.)?([a-z0-9_]+)/i
  );
  return cache?.[1];
}

export function isMissingRpcInSchemaCache(
  error: PostgresErrorLike | null | undefined
): boolean {
  const parsed = parsePostgresError(error);
  const message = parsed.message.toLowerCase();
  return (
    parsed.pgCode === PG_ERROR_CODES.UNDEFINED_FUNCTION ||
    parsed.pgCode === "PGRST202" ||
    message.includes("schema cache") ||
    message.includes("could not find the function")
  );
}

/** Extracts relation name from undefined_table (42P01) errors. */
export function extractUndefinedRelationName(message: string): string | undefined {
  const match = message.match(/relation "([^"]+)" does not exist/i);
  return match?.[1];
}

/** Extracts check constraint name from check_violation (23514) errors. */
export function extractCheckConstraintName(message: string): string | undefined {
  const match = message.match(/violates check constraint "([^"]+)"/i);
  return match?.[1];
}

export function parsePostgresError(
  error: PostgresErrorLike | null | undefined
): ParsedPostgresError {
  const pgCode = trimOrUndefined(error?.code);
  const message = trimOrUndefined(error?.message) ?? "";
  const details = trimOrUndefined(error?.details);
  const hint = trimOrUndefined(error?.hint);

  const rpcCode =
    extractRpcCodeCandidate(details) ??
    extractRpcCodeCandidate(hint) ??
    extractRpcCodeCandidate(message);

  return {
    pgCode,
    message,
    details,
    hint,
    rpcCode,
    undefinedFunctionName: extractUndefinedFunctionName(message),
    missingColumnKey: extractMissingColumnKey(message),
    undefinedRelationName: extractUndefinedRelationName(message),
    checkConstraintName: extractCheckConstraintName(message),
  };
}

export function getRpcCode(error: PostgresErrorLike | null | undefined): RpcErrorCode | undefined {
  return parsePostgresError(error).rpcCode;
}

export function isUniqueViolation(error: PostgresErrorLike | null | undefined): boolean {
  return parsePostgresError(error).pgCode === PG_ERROR_CODES.UNIQUE_VIOLATION;
}

export function isUndefinedFunction(error: PostgresErrorLike | null | undefined): boolean {
  return parsePostgresError(error).pgCode === PG_ERROR_CODES.UNDEFINED_FUNCTION;
}

export function isUndefinedTable(error: PostgresErrorLike | null | undefined): boolean {
  return parsePostgresError(error).pgCode === PG_ERROR_CODES.UNDEFINED_TABLE;
}

export function isCheckViolation(error: PostgresErrorLike | null | undefined): boolean {
  return parsePostgresError(error).pgCode === PG_ERROR_CODES.CHECK_VIOLATION;
}

export type ResolvePostgresUserMessageOptions = {
  rpcMessages?: Partial<Record<RpcErrorCode, string>>;
  fallback?: string;
};

/**
 * Maps a Supabase/PostgREST error to a user-facing message using SQLSTATE,
 * RPC codes (DETAIL / legacy exact message), and structured PostgreSQL metadata.
 */
export function resolvePostgresUserMessage(
  error: PostgresErrorLike | null | undefined,
  options: ResolvePostgresUserMessageOptions = {}
): string {
  const parsed = parsePostgresError(error);
  const { rpcMessages, fallback } = options;

  if (parsed.rpcCode) {
    if (parsed.message && parsed.message !== parsed.rpcCode) {
      return rpcMessages?.[parsed.rpcCode] ?? parsed.message;
    }
    return rpcMessages?.[parsed.rpcCode] ?? RPC_USER_MESSAGES[parsed.rpcCode];
  }

  if (parsed.undefinedFunctionName) {
    const hint = FUNCTION_MIGRATION_HINTS[parsed.undefinedFunctionName];
    if (hint) return hint;
  }

  if (parsed.pgCode === PG_ERROR_CODES.UNDEFINED_TABLE && parsed.undefinedRelationName) {
    const hint = TABLE_MIGRATION_HINTS[parsed.undefinedRelationName];
    if (hint) return hint;
  }

  if (parsed.pgCode === PG_ERROR_CODES.UNDEFINED_COLUMN && parsed.missingColumnKey) {
    const hint = COLUMN_MIGRATION_HINTS[parsed.missingColumnKey];
    if (hint) return hint;
  }

  if (parsed.pgCode === PG_ERROR_CODES.CHECK_VIOLATION && parsed.checkConstraintName) {
    const hint = CHECK_CONSTRAINT_HINTS[parsed.checkConstraintName];
    if (hint) return hint;
  }

  if (parsed.message?.includes("clinical_record_audit_changed_by_fkey")) {
    return "Falta la migración 093 en Supabase. Ejecutá supabase/scripts/prod-fix-user-deletion-complete.sql y volvé a intentar.";
  }

  if (parsed.message?.includes("appointment_status_history_changed_by_fkey")) {
    return "Falta la migración 094 en Supabase. Ejecutá supabase/scripts/prod-fix-user-deletion-complete.sql y volvé a intentar.";
  }

  if (parsed.message?.includes("cancellation_category")) {
    return (
      COLUMN_MIGRATION_HINTS["appointments.cancellation_category"] ??
      "Falta actualizar la base de datos para cancelaciones. Ejecutá supabase/scripts/prod-fix-appointment-cancellation.sql."
    );
  }

  for (const [needle, hint] of Object.entries(SCHEMA_CACHE_HINTS)) {
    if (parsed.message === needle) return hint;
  }

  return fallback ?? parsed.message ?? "Ocurrió un error inesperado.";
}

/** Repository-level DB error mapping without substring matching. */
export function resolveRepositoryDbError(
  error: PostgresErrorLike | null | undefined,
  extraColumnHints: Record<string, string> = {}
): string {
  const parsed = parsePostgresError(error);

  if (parsed.rpcCode) {
    return RPC_USER_MESSAGES[parsed.rpcCode];
  }

  if (parsed.pgCode === PG_ERROR_CODES.UNDEFINED_COLUMN && parsed.missingColumnKey) {
    return (
      extraColumnHints[parsed.missingColumnKey] ??
      COLUMN_MIGRATION_HINTS[parsed.missingColumnKey] ??
      parsed.message
    );
  }

  if (parsed.pgCode === PG_ERROR_CODES.UNDEFINED_FUNCTION && parsed.undefinedFunctionName) {
    const hint = FUNCTION_MIGRATION_HINTS[parsed.undefinedFunctionName];
    if (hint) return hint;
  }

  const schemaHint = SCHEMA_CACHE_HINTS[parsed.message];
  if (schemaHint) return schemaHint;

  return parsed.message || "Ocurrió un error inesperado.";
}
