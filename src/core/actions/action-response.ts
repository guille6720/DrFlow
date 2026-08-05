import type { ImportAccessResult } from "@/core/services/import-access.service";
import type { ServiceResult } from "@/core/services/types";

/** Standard server-action failure shape. */
export type ActionError = { error: string };

/** Standard server-action success for mutations without payload. */
export type ActionSuccess = { success: true };

export function actionError(error: string): ActionError {
  return { error };
}

export function actionSuccess(): ActionSuccess {
  return { success: true };
}

/** Resolves clinic permission guards into action-ready results. */
export function resolvePermissionAccess(
  access: { ok: true; clinicId: string } | { ok: false; error: string }
):
  | { ok: true; clinicId: string }
  | { ok: false; error: string } {
  return access.ok ? { ok: true, clinicId: access.clinicId } : { ok: false, error: access.error };
}

type AccessFields = {
  error: string | null;
  clinicId: string | null;
  userId: string | null;
};

/** Generic access gate resolver for import/clinical/reset flows. */
export function resolveAccessFields(
  access: AccessFields,
  options?: { requireUserId?: boolean; fallback?: string }
):
  | { ok: true; clinicId: string; userId: string }
  | { ok: false; error: string } {
  const fallback = options?.fallback ?? "Sin permisos";
  const missingUser = options?.requireUserId !== false && !access.userId;
  if (access.error || !access.clinicId || missingUser) {
    return { ok: false, error: access.error ?? fallback };
  }
  return { ok: true, clinicId: access.clinicId, userId: access.userId as string };
}

/** Resolves import/clinical-import access gates (preserves fallback messages). */
export function resolveImportAccess(
  access: ImportAccessResult,
  options?: { requireUserId?: boolean; fallback?: string }
):
  | { ok: true; clinicId: string; userId: string }
  | { ok: false; error: string } {
  return resolveAccessFields(access, options);
}

/** Resolves clinical record/view access gates. */
export function resolveClinicalRecordAccess(
  access: {
    error: string | null;
    clinicId: string | null;
    userId?: string | null;
  },
  options?: { requireUserId?: boolean; fallback?: string }
):
  | { ok: true; clinicId: string; userId?: string }
  | { ok: false; error: string } {
  const fallback = options?.fallback ?? "Sin permisos";
  if (options?.requireUserId === false) {
    if (access.error || !access.clinicId) {
      return { ok: false, error: access.error ?? fallback };
    }
    return { ok: true, clinicId: access.clinicId };
  }
  const resolved = resolveAccessFields(
    {
      error: access.error,
      clinicId: access.clinicId,
      userId: access.userId ?? null,
    },
    options
  );
  return resolved;
}

/** Maps domain service results to action errors. */
export function serviceDenied<T>(result: ServiceResult<T>): ActionError | null {
  return result.ok ? null : actionError(result.error);
}

/** @deprecated Use resolvePermissionAccess — kept for gradual migration. */
export function permissionDenied(
  access: { ok: true } | { ok: false; error: string }
): ActionError | null {
  return access.ok ? null : actionError(access.error);
}

/** @deprecated Use resolveImportAccess — kept for gradual migration. */
export function importAccessDenied(
  access: ImportAccessResult,
  options?: { requireUserId?: boolean; fallback?: string }
): ActionError | null {
  const resolved = resolveImportAccess(access, options);
  return resolved.ok ? null : actionError(resolved.error);
}

/** @deprecated Use resolveClinicalRecordAccess — kept for gradual migration. */
export function clinicalRecordAccessDenied(
  access: {
    error: string | null;
    clinicId: string | null;
    userId?: string | null;
  },
  options?: { requireUserId?: boolean; fallback?: string }
): ActionError | null {
  const resolved = resolveClinicalRecordAccess(access, options);
  return resolved.ok ? null : actionError(resolved.error);
}
