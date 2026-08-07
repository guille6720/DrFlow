export { toError, toErrorMessage, toPostgrestErrorMessage } from "@/core/errors/error-utils";
export { logClientError } from "@/core/errors/log-error.client";
export {
  extractCheckConstraintName,
  extractMissingColumnKey,
  extractUndefinedFunctionName,
  extractUndefinedRelationName,
  getRpcCode,
  isCheckViolation,
  isUndefinedFunction,
  isUndefinedTable,
  isUniqueViolation,
  type ParsedPostgresError,
  parsePostgresError,
  PG_ERROR_CODES,
  type PostgresErrorLike,
  resolvePostgresUserMessage,
  type ResolvePostgresUserMessageOptions,
  resolveRepositoryDbError,
} from "@/core/errors/postgres-error";
export {
  isKnownRpcErrorCode,
  RPC_ERROR_CODES,
  RPC_USER_MESSAGES,
  type RpcErrorCode,
} from "@/core/errors/rpc-error-messages";
