/**
 * Typed error taxonomy for ReNaPDiS repository providers.
 * Messages returned to users are fixed Spanish strings — provider bodies are never surfaced.
 */

export const REPOSITORY_ERROR_CODES = [
  "network_timeout",
  "rate_limited",
  "provider_unavailable",
  "server_error",
  "invalid_professional",
  "invalid_prescription",
  "invalid_patient",
  "invalid_establishment",
  "unauthorized",
  "rejected",
  "not_configured",
  "unknown_provider",
  "missing_credentials",
  "invalid_response",
  "unsupported_operation",
] as const;

export type RepositoryErrorCode = (typeof REPOSITORY_ERROR_CODES)[number];

const RETRYABLE: ReadonlySet<RepositoryErrorCode> = new Set([
  "network_timeout",
  "rate_limited",
  "provider_unavailable",
  "server_error",
]);

/** Errors that mean "the national service is down / not usable right now" (prescription stays recoverable). */
const UNAVAILABLE: ReadonlySet<RepositoryErrorCode> = new Set([
  "network_timeout",
  "rate_limited",
  "provider_unavailable",
  "server_error",
  "not_configured",
  "unknown_provider",
  "missing_credentials",
]);

const USER_MESSAGES: Record<RepositoryErrorCode, string> = {
  network_timeout: "El repositorio de recetas no respondió a tiempo. La receta queda pendiente para reintentar.",
  rate_limited: "El repositorio de recetas está limitando solicitudes. Reintentá en unos minutos.",
  provider_unavailable: "El repositorio de recetas no está disponible. La receta queda pendiente para reintentar.",
  server_error: "El repositorio de recetas tuvo un error temporal. La receta queda pendiente para reintentar.",
  invalid_professional: "El repositorio rechazó los datos del profesional. Revisá matrícula y validación REFEPS.",
  invalid_prescription: "El repositorio rechazó el contenido de la receta. Revisá los datos y volvé a emitir.",
  invalid_patient: "El repositorio rechazó la identificación del paciente. Revisá documento/CUIL.",
  invalid_establishment: "El repositorio rechazó el establecimiento. Revisá el código de establecimiento.",
  unauthorized: "Las credenciales de integración con el repositorio no son válidas. Contactá al administrador.",
  rejected: "El repositorio rechazó la receta.",
  not_configured: "La receta electrónica nacional no está configurada para este consultorio.",
  unknown_provider: "El proveedor de repositorio configurado no es reconocido. Envío nacional bloqueado.",
  missing_credentials: "Faltan credenciales oficiales de integración. Envío nacional bloqueado.",
  invalid_response: "El repositorio devolvió una respuesta inválida. No se registró ningún CUIR.",
  unsupported_operation: "El proveedor de repositorio no soporta esta operación.",
};

export function isRetryableRepositoryError(code: RepositoryErrorCode): boolean {
  return RETRYABLE.has(code);
}

export function isRepositoryUnavailableError(code: RepositoryErrorCode): boolean {
  return UNAVAILABLE.has(code);
}

export function repositoryErrorUserMessage(code: RepositoryErrorCode): string {
  return USER_MESSAGES[code];
}

export class RepositoryProviderError extends Error {
  readonly code: RepositoryErrorCode;
  readonly retryable: boolean;
  readonly httpStatus: number | null;
  readonly providerRequestId: string | null;

  constructor(
    code: RepositoryErrorCode,
    options?: { httpStatus?: number | null; providerRequestId?: string | null }
  ) {
    super(USER_MESSAGES[code]);
    this.name = "RepositoryProviderError";
    this.code = code;
    this.retryable = RETRYABLE.has(code);
    this.httpStatus = options?.httpStatus ?? null;
    this.providerRequestId = options?.providerRequestId ?? null;
  }
}

/** Generic HTTP → taxonomy mapping. Vendor adapters may refine 4xx using their documented error codes. */
export function classifyHttpStatus(status: number): RepositoryErrorCode {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 408) return "network_timeout";
  if (status === 429) return "rate_limited";
  if (status === 502 || status === 503 || status === 504) return "provider_unavailable";
  if (status >= 500) return "server_error";
  if (status === 422 || status === 400) return "invalid_prescription";
  return "rejected";
}

/** Normalizes anything thrown by an adapter/fetch into the taxonomy (never leaks raw messages). */
export function toRepositoryProviderError(error: unknown): RepositoryProviderError {
  if (error instanceof RepositoryProviderError) return error;
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return new RepositoryProviderError("network_timeout");
  }
  if (error instanceof TypeError) {
    return new RepositoryProviderError("provider_unavailable");
  }
  return new RepositoryProviderError("invalid_response");
}
