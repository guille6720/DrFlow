import "server-only";

import { createClient } from "@/core/supabase/server";
import { getSession } from "@/core/auth/session";
import { getAuditRequestContext } from "@/core/security/audit-context";
import {
  auditFieldChanges,
  buildAuditLogRow,
  type AuditModule,
} from "@/core/security/audit-log";
import type { AuditAction } from "@/core/security/audit-types";

export type RecordAuditParams = {
  clinicId?: string;
  module?: AuditModule;
  what?: string;
  entityType: string;
  entityId?: string;
  patientId?: string;
  action: AuditAction;
  metadata?: Record<string, unknown>;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  /** Override session user (e.g. explicit actor). */
  userId?: string;
};

export type RecordAuditChangeParams<T extends Record<string, unknown>> = Omit<
  RecordAuditParams,
  "oldValues" | "newValues"
> & {
  before?: T | null;
  after?: T | null;
  keys: (keyof T)[];
};

/**
 * Centralized immutable audit trail writer.
 * Captures user, timestamp (DB), IP, user-agent, action, resource, and optional diffs.
 * Failures are logged but never block the calling mutation.
 */
export async function recordAudit(params: RecordAuditParams): Promise<void> {
  try {
    const supabase = await createClient();
    const sessionUser = await getSession();
    const userId = params.userId ?? sessionUser?.id;
    if (!userId) return;

    const ctx = await getAuditRequestContext();

    const { error } = await supabase.from("audit_logs").insert(
      buildAuditLogRow({
        clinicId: params.clinicId,
        module: params.module,
        what: params.what,
        entityType: params.entityType,
        entityId: params.entityId,
        patientId: params.patientId,
        action: params.action,
        metadata: params.metadata,
        oldValues: params.oldValues,
        newValues: params.newValues,
        userId,
        ipAddress: ctx.ip_address,
        userAgent: ctx.user_agent,
      })
    );

    if (error) {
      console.error("[audit] insert failed:", error.message);
    }
  } catch (err) {
    console.error("[audit] record failed:", err);
  }
}

/** Records audit with sanitized old/new field diffs. */
export async function recordAuditChange<T extends Record<string, unknown>>(
  params: RecordAuditChangeParams<T>
): Promise<void> {
  const { before, after, keys, ...rest } = params;
  const { oldValues, newValues } = auditFieldChanges(before, after, keys);
  await recordAudit({ ...rest, oldValues, newValues });
}
