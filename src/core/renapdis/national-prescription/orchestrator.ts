/**
 * National e-Rx orchestration (pure; all I/O injected):
 *   gates → REFEPS professional validation → repository submission → CUIR (only from a real repository).
 *
 * Invariants:
 * - Local prescription data is never modified here (only national columns).
 * - One logical submission per prescription: stable idempotency key + compare-and-set claims.
 * - A CUIR is persisted only when an external provider returns a valid official CUIR.
 * - Sandbox results populate `sandbox_reference` only.
 */

import type {
  NationalRxActor,
  NationalRxAuditEvent,
  NationalRxBlockCode,
  NationalRxDeps,
  NationalRxGates,
  NationalRxPatch,
  NationalRxRecord,
  NationalRxResult,
} from "@/core/renapdis/national-prescription/types";
import {
  NATIONAL_RX_REGISTERED_STATES,
  NATIONAL_RX_SUBMITTABLE_STATES,
  type NationalRxState,
  transitionNationalRx,
} from "@/core/renapdis/national-state-machine";
import { DEFAULT_RETRY_POLICY, withRepositoryRetry } from "@/core/renapdis/repository/repository-client";
import {
  isRepositoryUnavailableError,
  type RepositoryErrorCode,
  repositoryErrorUserMessage,
  toRepositoryProviderError,
} from "@/core/renapdis/repository/repository-errors";
import type { RepositoryCallContext } from "@/core/renapdis/repository/repository-types";
import { isAcceptableOfficialCuir } from "@/core/renapdis/repository/repository-validation";

const DEFAULT_STALE_MS = 5 * 60_000;

const BLOCK_MESSAGES: Partial<Record<NationalRxBlockCode, string>> = {
  permission_denied: "No tenés permiso para emitir recetas.",
  plan_not_entitled: "El plan de la clínica no incluye recetas.",
  feature_disabled: "La receta electrónica nacional no está habilitada para esta clínica.",
  mfa_required: "Confirmá MFA (AAL2) antes de enviar la receta nacional.",
  establishment_missing: "Falta el código de establecimiento de la clínica.",
  not_found: "Receta no encontrada.",
  not_issued: "Solo se pueden enviar recetas emitidas.",
  cancelled: "La receta nacional está anulada.",
  refeps_unavailable: "La validación REFEPS no está disponible. La receta local sigue siendo válida como receta local; el envío nacional queda bloqueado.",
  professional_invalid: "El profesional no pudo ser validado en REFEPS. No se envió nada al repositorio.",
  official_validation_required: "Un repositorio oficial requiere validación REFEPS oficial (no sandbox).",
  in_progress: "El envío nacional ya está en curso. Esperá unos segundos y actualizá.",
  invalid_state: "La receta no está en un estado que permita esta acción.",
};

function blockMessage(code: NationalRxBlockCode): string {
  return BLOCK_MESSAGES[code] ?? repositoryErrorUserMessage(code as RepositoryErrorCode);
}

function fail(code: NationalRxBlockCode, state: NationalRxState | null, recoverable: boolean): NationalRxResult {
  return { ok: false, code, message: blockMessage(code), state, recoverable };
}

function effectiveState(record: NationalRxRecord): NationalRxState {
  return record.nationalState ?? "issued_local";
}

export async function submitNationalPrescription(
  actor: NationalRxActor,
  gates: NationalRxGates,
  prescriptionId: string,
  deps: NationalRxDeps
): Promise<NationalRxResult> {
  const now = deps.now ?? (() => new Date());
  const iso = () => now().toISOString();
  const correlationId = deps.uuid();
  const providerId = deps.provider.id;

  const audit = async (
    event: NationalRxAuditEvent,
    record: Pick<NationalRxRecord, "id" | "professionalId"> | null,
    status: string,
    extra: { error_code?: string | null; attempts?: number; mode?: string | null } = {}
  ) => {
    await deps.audit(event, {
      clinic_id: actor.clinicId,
      prescription_id: record?.id ?? prescriptionId,
      professional_id: record?.professionalId ?? null,
      provider: providerId,
      status,
      correlation_id: correlationId,
      timestamp: iso(),
      ...extra,
    });
  };

  const blocked = async (code: NationalRxBlockCode, record: NationalRxRecord | null, recoverable: boolean) => {
    await audit("national_prescription_blocked", record, code, { error_code: code });
    return fail(code, record ? effectiveState(record) : null, recoverable);
  };

  // 1. Gates (RBAC → plan → feature → MFA → clinic configuration). Order matters: cheapest/most basic first.
  if (!gates.hasPermission) return blocked("permission_denied", null, false);
  if (!gates.productEntitled) return blocked("plan_not_entitled", null, false);
  if (!gates.featureEnabled) return blocked("feature_disabled", null, false);
  if (!gates.mfaElevated) return blocked("mfa_required", null, true);
  if (!gates.establishmentCode?.trim()) return blocked("establishment_missing", null, true);

  // 2. Repository configuration must be usable (unknown provider / missing credentials fail closed).
  if (!deps.repositoryConfig.configured || deps.provider.mode === "not_configured") {
    const code: RepositoryErrorCode =
      deps.repositoryConfig.reason === "missing_credentials"
        ? "missing_credentials"
        : deps.repositoryConfig.reason === "unknown_provider" || deps.repositoryConfig.reason === "adapter_not_registered"
          ? "unknown_provider"
          : "not_configured";
    return blocked(code, null, true);
  }

  // 3. Load (scoped by server-validated clinic) and check idempotent short-circuits.
  let record = await deps.store.load(prescriptionId, actor.clinicId);
  if (!record || record.clinicId !== actor.clinicId) return fail("not_found", null, false);
  if (record.status !== "issued") return blocked("not_issued", record, false);

  let state = effectiveState(record);
  if (state === "cancelled") return fail("cancelled", state, false);
  if (NATIONAL_RX_REGISTERED_STATES.has(state)) {
    return {
      ok: true,
      outcome: "already_registered",
      state,
      sandboxReference: record.sandboxReference,
      cuir: record.cuir,
    };
  }

  const staleMs = deps.staleAfterMs ?? DEFAULT_STALE_MS;
  const isPending = state === "professional_validation_pending" || state === "repository_submission_pending" || state === "professional_validated";
  if (isPending) {
    const age = record.nationalUpdatedAt ? now().getTime() - new Date(record.nationalUpdatedAt).getTime() : Infinity;
    if (age < staleMs) return fail("in_progress", state, true);
    // Interrupted run (crash/timeout): mark recoverable, keep the SAME idempotency key for the retry.
    if (state !== "professional_validated") {
      const recoveryState: NationalRxState =
        state === "repository_submission_pending" ? "repository_unavailable" : "professional_validation_failed";
      const recovered = await deps.store.update(record.id, actor.clinicId, record.nationalUpdatedAt, {
        national_rx_state: recoveryState,
        repository_error_code: "network_timeout",
        repository_error_message: repositoryErrorUserMessage("network_timeout"),
      });
      if (!recovered) return fail("in_progress", state, true);
      record = recovered;
      state = recoveryState;
    }
  }

  const resumable = NATIONAL_RX_SUBMITTABLE_STATES.has(state) || state === "professional_validated";
  if (!resumable) return fail("invalid_state", state, false);

  // 4. Build + validate the normalized request BEFORE claiming (no state change on local data errors).
  const submissionId = record.submissionId ?? deps.uuid();
  const built = await deps.data.buildSubmission(record, submissionId, gates.establishmentCode.trim());
  if (!built.ok) return blocked(built.code, record, true);

  // 5. Claim: compare-and-set into professional_validation_pending (loses cleanly on double click).
  const idempotencyKey = record.idempotencyKey ?? `nrx:${actor.clinicId}:${record.id}:${submissionId}`;
  const claimTransition = transitionNationalRx(state, "professional_validation_pending");
  if (!claimTransition.ok) return fail("invalid_state", state, false);
  const claimed = await deps.store.update(record.id, actor.clinicId, record.nationalUpdatedAt, {
    national_rx_state: "professional_validation_pending",
    national_submission_id: submissionId,
    national_idempotency_key: idempotencyKey,
    national_correlation_id: correlationId,
    national_attempts: record.attempts + 1,
    repository_error_code: null,
    repository_error_message: null,
  });
  if (!claimed) return fail("in_progress", state, true);
  record = claimed;

  const move = async (to: NationalRxState, patch: NationalRxPatch = {}, ctx: Parameters<typeof transitionNationalRx>[2] = {}) => {
    const t = transitionNationalRx(effectiveState(record!), to, ctx);
    if (!t.ok) return null;
    const next = await deps.store.update(record!.id, actor.clinicId, record!.nationalUpdatedAt, { ...patch, national_rx_state: to });
    if (next) record = next;
    return next;
  };

  // 6. REFEPS professional validation (independent from the repository).
  await audit("refeps_validation_requested", record, "requested");
  const validation = await deps.validateProfessional(built.refepsInput);
  const validationPatch: NationalRxPatch = {
    refeps_professional_status: validation.status,
    refeps_validation_mode: validation.mode,
    refeps_validated_at: validation.valid ? (validation.validatedAt ?? iso()) : null,
  };

  if (!validation.valid) {
    await move("professional_validation_failed", validationPatch);
    await audit("refeps_validation_failed", record, validation.status, { mode: validation.mode });
    return validation.status === "unavailable"
      ? fail("refeps_unavailable", "professional_validation_failed", true)
      : fail("professional_invalid", "professional_validation_failed", true);
  }
  if (deps.provider.mode === "external" && validation.mode !== "official") {
    await move("professional_validation_failed", validationPatch);
    await audit("refeps_validation_failed", record, "official_validation_required", { mode: validation.mode });
    return fail("official_validation_required", "professional_validation_failed", false);
  }
  if (!(await move("professional_validated", validationPatch))) return fail("in_progress", effectiveState(record), true);
  await audit("refeps_validation_success", record, validation.status, { mode: validation.mode });

  // 7. Repository submission (bounded retries on retryable errors only; same idempotency key).
  if (!(await move("repository_submission_pending", { repository_provider: providerId, repository_mode: deps.provider.mode === "sandbox" ? "sandbox" : "external" }))) {
    return fail("in_progress", effectiveState(record), true);
  }
  await audit("repository_submission_requested", record, "requested", { mode: deps.provider.mode });

  const ctx: RepositoryCallContext = { idempotencyKey, correlationId, timeoutMs: deps.repositoryConfig.timeoutMs };
  let attempts = 0;
  try {
    const { value: response, attempts: used } = await withRepositoryRetry(
      () => deps.provider.submitPrescription(built.request, ctx),
      deps.retryPolicy ?? DEFAULT_RETRY_POLICY,
      deps.retryHooks
    );
    attempts = used;
    const submittedAt = iso();

    if (response.mode === "sandbox" || deps.provider.mode === "sandbox") {
      const sandboxReference = response.mode === "sandbox" ? response.sandboxReference : null;
      if (!sandboxReference) throw toRepositoryProviderError(new Error("sandbox_without_reference"));
      await move("repository_submitted", {
        repository_prescription_id: response.repositoryPrescriptionId,
        provider_request_id: response.providerRequestId,
        repository_status: response.status,
        repository_submitted_at: submittedAt,
        repository_last_checked_at: submittedAt,
        sandbox_reference: sandboxReference,
      });
      await audit("repository_submission_success", record, "registered_sandbox", { attempts, mode: "sandbox" });
      return { ok: true, outcome: "registered_sandbox", state: "repository_submitted", sandboxReference, cuir: null };
    }

    const basePatch: NationalRxPatch = {
      repository_prescription_id: response.repositoryPrescriptionId,
      provider_request_id: response.providerRequestId,
      repository_status: response.status,
      repository_submitted_at: submittedAt,
      repository_last_checked_at: submittedAt,
    };

    if (response.cuir && isAcceptableOfficialCuir(response.cuir)) {
      const assigned = await move(
        "cuir_assigned",
        { ...basePatch, cuir: response.cuir, cuir_received_at: submittedAt },
        { cuir: response.cuir, repositoryMode: "external" }
      );
      if (assigned) {
        await audit("repository_submission_success", record, "registered", { attempts, mode: "external" });
        await audit("cuir_received", record, "cuir_assigned", { mode: "external" });
        return { ok: true, outcome: "cuir_assigned", state: "cuir_assigned", sandboxReference: null, cuir: response.cuir };
      }
    }

    await move("repository_submitted", basePatch);
    await audit("repository_submission_success", record, "registered_pending_cuir", { attempts, mode: "external" });
    return { ok: true, outcome: "registered", state: "repository_submitted", sandboxReference: null, cuir: null };
  } catch (raw) {
    const error = toRepositoryProviderError(raw);
    const to: NationalRxState = isRepositoryUnavailableError(error.code) ? "repository_unavailable" : "repository_submission_failed";
    await move(to, {
      repository_error_code: error.code,
      repository_error_message: repositoryErrorUserMessage(error.code),
      provider_request_id: error.providerRequestId,
      repository_last_checked_at: iso(),
    });
    await audit("repository_submission_failed", record, to, { error_code: error.code, attempts: attempts || undefined });
    return fail(error.code, to, true);
  }
}

/** Polls the repository for a CUIR (external only). Sandbox never yields a CUIR. */
export async function refreshNationalPrescriptionStatus(
  actor: NationalRxActor,
  gates: Pick<NationalRxGates, "hasPermission" | "featureEnabled">,
  prescriptionId: string,
  deps: Pick<NationalRxDeps, "store" | "audit" | "provider" | "repositoryConfig" | "uuid" | "now">
): Promise<NationalRxResult> {
  const now = deps.now ?? (() => new Date());
  if (!gates.hasPermission) return fail("permission_denied", null, false);
  if (!gates.featureEnabled) return fail("feature_disabled", null, false);

  const record = await deps.store.load(prescriptionId, actor.clinicId);
  if (!record || record.clinicId !== actor.clinicId) return fail("not_found", null, false);
  const state = effectiveState(record);
  const correlationId = deps.uuid();
  const meta = (status: string, extra: Record<string, unknown> = {}) => ({
    clinic_id: actor.clinicId,
    prescription_id: record.id,
    professional_id: record.professionalId,
    provider: deps.provider.id,
    status,
    correlation_id: correlationId,
    timestamp: now().toISOString(),
    ...extra,
  });

  if (record.repositoryMode !== "external" || deps.provider.mode !== "external" || !record.repositoryPrescriptionId) {
    return { ok: true, outcome: "status_refreshed", state, sandboxReference: record.sandboxReference, cuir: record.cuir };
  }
  if (state !== "repository_submitted" && state !== "cuir_assigned" && state !== "cuir_verification_failed") {
    return fail("invalid_state", state, false);
  }

  const ctx: RepositoryCallContext = {
    idempotencyKey: record.idempotencyKey ?? record.id,
    correlationId,
    timeoutMs: deps.repositoryConfig.timeoutMs,
  };
  try {
    if (!record.cuir) {
      const status = await deps.provider.getPrescriptionStatus(record.repositoryPrescriptionId, ctx);
      const checkedAt = now().toISOString();
      if (status.cuir && isAcceptableOfficialCuir(status.cuir) && transitionNationalRx(state, "cuir_assigned", { cuir: status.cuir, repositoryMode: "external" }).ok) {
        const next = await deps.store.update(record.id, actor.clinicId, record.nationalUpdatedAt, {
          national_rx_state: "cuir_assigned",
          cuir: status.cuir,
          cuir_received_at: checkedAt,
          repository_status: status.status,
          repository_last_checked_at: checkedAt,
        });
        if (next) {
          await deps.audit("cuir_received", meta("cuir_assigned"));
          return { ok: true, outcome: "cuir_assigned", state: "cuir_assigned", sandboxReference: null, cuir: status.cuir };
        }
      }
      await deps.store.update(record.id, actor.clinicId, record.nationalUpdatedAt, {
        repository_status: status.status,
        repository_last_checked_at: checkedAt,
      });
      return { ok: true, outcome: "status_refreshed", state, sandboxReference: null, cuir: null };
    }

    const verification = await deps.provider.verifyCuir(record.cuir, ctx);
    const checkedAt = now().toISOString();
    if (verification.valid) {
      const to: NationalRxState = "cuir_assigned";
      await deps.store.update(record.id, actor.clinicId, record.nationalUpdatedAt, {
        ...(state !== to ? { national_rx_state: to } : {}),
        cuir_verified_at: checkedAt,
        repository_last_checked_at: checkedAt,
      });
      await deps.audit("cuir_verified", meta("valid"));
      return { ok: true, outcome: "status_refreshed", state: to, sandboxReference: null, cuir: record.cuir };
    }
    if (transitionNationalRx(state, "cuir_verification_failed").ok) {
      await deps.store.update(record.id, actor.clinicId, record.nationalUpdatedAt, {
        national_rx_state: "cuir_verification_failed",
        repository_last_checked_at: checkedAt,
      });
    }
    await deps.audit("cuir_verification_failed", meta("invalid"));
    return fail("rejected", "cuir_verification_failed", true);
  } catch (raw) {
    const error = toRepositoryProviderError(raw);
    await deps.audit("cuir_verification_failed", meta("error", { error_code: error.code }));
    return fail(error.code, state, true);
  }
}

/** Cancels the national registration (repository first when registered). Local void stays a separate action. */
export async function cancelNationalPrescription(
  actor: NationalRxActor,
  gates: Pick<NationalRxGates, "hasPermission" | "featureEnabled">,
  prescriptionId: string,
  reasonCode: string,
  deps: Pick<NationalRxDeps, "store" | "audit" | "provider" | "repositoryConfig" | "uuid" | "now">
): Promise<NationalRxResult> {
  const now = deps.now ?? (() => new Date());
  if (!gates.hasPermission) return fail("permission_denied", null, false);
  if (!gates.featureEnabled) return fail("feature_disabled", null, false);

  const record = await deps.store.load(prescriptionId, actor.clinicId);
  if (!record || record.clinicId !== actor.clinicId) return fail("not_found", null, false);
  const state = effectiveState(record);
  if (state === "cancelled") return { ok: true, outcome: "cancelled", state, sandboxReference: record.sandboxReference, cuir: record.cuir };
  if (!transitionNationalRx(state, "cancelled").ok) return fail("invalid_state", state, false);

  const correlationId = deps.uuid();
  if (NATIONAL_RX_REGISTERED_STATES.has(state) && record.repositoryPrescriptionId) {
    if (record.repositoryMode === "external" && deps.provider.mode !== "external") return fail("not_configured", state, true);
    try {
      const res = await deps.provider.cancelPrescription(record.repositoryPrescriptionId, reasonCode.slice(0, 40), {
        idempotencyKey: `${record.idempotencyKey ?? record.id}:cancel`,
        correlationId,
        timeoutMs: deps.repositoryConfig.timeoutMs,
      });
      if (!res.cancelled) return fail("rejected", state, true);
    } catch (raw) {
      return fail(toRepositoryProviderError(raw).code, state, true);
    }
  }

  const next = await deps.store.update(record.id, actor.clinicId, record.nationalUpdatedAt, {
    national_rx_state: "cancelled",
    repository_status: record.repositoryPrescriptionId ? "cancelled" : record.repositoryStatus,
    repository_last_checked_at: now().toISOString(),
  });
  if (!next) return fail("in_progress", state, true);
  await deps.audit("national_prescription_cancelled", {
    clinic_id: actor.clinicId,
    prescription_id: record.id,
    professional_id: record.professionalId,
    provider: record.repositoryProvider,
    status: "cancelled",
    correlation_id: correlationId,
    timestamp: now().toISOString(),
  });
  return { ok: true, outcome: "cancelled", state: "cancelled", sandboxReference: record.sandboxReference, cuir: record.cuir };
}
