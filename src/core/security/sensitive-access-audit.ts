import "server-only";

import { getSession } from "@/core/auth/session.server";
import { recordAudit } from "@/core/security/audit-service";
import { createClient } from "@/core/supabase/server";

import type { PatientWorkspaceTabId } from "@/features/pacientes/constants/patient-workspace-tabs";
import type { WorkspaceFetchPlan } from "@/features/pacientes/server/patient-workspace-fetch-plan";

/** Window to suppress duplicate view logs for the same context (tab / record). */
export const SENSITIVE_ACCESS_DEDUPE_MINUTES = 15;

export type SensitiveAccessKind =
  | "patient_workspace"
  | "clinical_record_detail"
  | "patient_admin_documents";

export type RecordSensitiveAccessParams = {
  clinicId: string;
  patientId: string;
  kind: SensitiveAccessKind;
  entityType?: string;
  entityId?: string;
  tab?: PatientWorkspaceTabId | string;
  path?: string;
  what?: string;
  skipDedupe?: boolean;
};

export function buildSensitiveAccessDedupeKey(params: {
  kind: SensitiveAccessKind;
  patientId: string;
  tab?: string;
  entityId?: string;
}): string {
  const parts = [params.kind, params.patientId];
  if (params.tab) parts.push(params.tab);
  if (params.entityId) parts.push(params.entityId);
  return parts.join(":");
}

/** True when the workspace tab loads clinical or attachment data worth auditing. */
export function shouldLogWorkspaceSensitiveAccess(
  tab: PatientWorkspaceTabId,
  plan: WorkspaceFetchPlan
): boolean {
  if (tab === "auditoria" || tab === "docs_admin") return false;
  return (
    plan.clinicalRecords ||
    plan.prescriptions ||
    plan.orders ||
    plan.attachments ||
    plan.hceSummary
  );
}

export function sensitiveAccessWhat(params: RecordSensitiveAccessParams): string {
  if (params.what?.trim()) return params.what.trim();
  const tabSuffix = params.tab ? ` (${params.tab})` : "";
  switch (params.kind) {
    case "clinical_record_detail":
      return `Consulta — historia clínica${tabSuffix}`;
    case "patient_admin_documents":
      return "Consulta — documentos administrativos del paciente";
    default:
      return `Consulta — datos clínicos del paciente${tabSuffix}`;
  }
}

async function hasRecentSensitiveAccess(
  dedupeKey: string,
  clinicId: string,
  patientId: string,
  userId: string
): Promise<boolean> {
  const since = new Date(
    Date.now() - SENSITIVE_ACCESS_DEDUPE_MINUTES * 60 * 1000
  ).toISOString();
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_logs")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .eq("user_id", userId)
    .eq("action", "view")
    .gte("created_at", since)
    .contains("metadata", { access_dedupe_key: dedupeKey })
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Immutable audit entry for reading sensitive patient/clinical data.
 * Uses action `view` with metadata.access_kind for filtering and dedupe.
 */
export async function recordSensitiveAccess(
  params: RecordSensitiveAccessParams
): Promise<void> {
  const sessionUser = await getSession();
  if (!sessionUser) return;

  const entityType = params.entityType ?? "patient";
  const entityId = params.entityId ?? params.patientId;
  const dedupeKey = buildSensitiveAccessDedupeKey({
    kind: params.kind,
    patientId: params.patientId,
    tab: params.tab,
    entityId: params.entityId,
  });

  if (!params.skipDedupe) {
    const skip = await hasRecentSensitiveAccess(
      dedupeKey,
      params.clinicId,
      params.patientId,
      sessionUser.id
    );
    if (skip) return;
  }

  await recordAudit({
    clinicId: params.clinicId,
    module: "clinical",
    what: sensitiveAccessWhat(params),
    entityType,
    entityId,
    patientId: params.patientId,
    action: "view",
    metadata: {
      access_kind: params.kind,
      tab: params.tab ?? null,
      path: params.path ?? null,
      access_dedupe_key: dedupeKey,
    },
  });
}

/** Fire-and-forget wrapper for page loaders — never blocks rendering. */
export function voidRecordSensitiveAccess(params: RecordSensitiveAccessParams): void {
  void recordSensitiveAccess(params);
}
