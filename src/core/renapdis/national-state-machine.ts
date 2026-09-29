/**
 * National electronic prescription lifecycle. Mirrored by the DB trigger
 * `guard_national_rx_state` (migration 20260929120000) — keep both in sync.
 */

import { isAcceptableOfficialCuir } from "@/core/renapdis/repository/repository-validation";

export const NATIONAL_RX_STATES = [
  "issued_local",
  "professional_validation_pending",
  "professional_validated",
  "professional_validation_failed",
  "repository_submission_pending",
  "repository_submitted",
  "repository_submission_failed",
  "repository_unavailable",
  "cuir_assigned",
  "cuir_verification_failed",
  "cancelled",
] as const;

export type NationalRxState = (typeof NATIONAL_RX_STATES)[number];

const TRANSITIONS: Readonly<Record<NationalRxState, readonly NationalRxState[]>> = {
  issued_local: ["professional_validation_pending", "cancelled"],
  professional_validation_pending: ["professional_validated", "professional_validation_failed"],
  professional_validated: ["repository_submission_pending", "professional_validation_pending", "cancelled"],
  professional_validation_failed: ["professional_validation_pending", "cancelled"],
  repository_submission_pending: [
    "repository_submitted",
    "repository_submission_failed",
    "repository_unavailable",
    "cuir_assigned",
  ],
  repository_submitted: ["cuir_assigned", "cuir_verification_failed", "cancelled"],
  repository_submission_failed: ["professional_validation_pending", "cancelled"],
  repository_unavailable: ["professional_validation_pending", "cancelled"],
  cuir_assigned: ["cuir_verification_failed", "cancelled"],
  cuir_verification_failed: ["cuir_assigned", "cancelled"],
  cancelled: [],
};

/** States from which a (re)submission may start. */
export const NATIONAL_RX_SUBMITTABLE_STATES: ReadonlySet<NationalRxState> = new Set([
  "issued_local",
  "professional_validation_failed",
  "repository_submission_failed",
  "repository_unavailable",
]);

/** A repository already holds (or may hold) this prescription — never submit again. */
export const NATIONAL_RX_REGISTERED_STATES: ReadonlySet<NationalRxState> = new Set([
  "repository_submitted",
  "cuir_assigned",
  "cuir_verification_failed",
]);

export function isNationalRxState(value: unknown): value is NationalRxState {
  return typeof value === "string" && (NATIONAL_RX_STATES as readonly string[]).includes(value);
}

export type TransitionContext = {
  /** CUIR returned by the repository, required to enter `cuir_assigned`. */
  cuir?: string | null;
  repositoryMode?: "sandbox" | "external" | null;
};

export type TransitionResult = { ok: true; to: NationalRxState } | { ok: false; error: "invalid_transition" | "cuir_required" | "sandbox_cannot_assign_cuir" };

export function canTransition(from: NationalRxState, to: NationalRxState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transitionNationalRx(
  from: NationalRxState,
  to: NationalRxState,
  ctx: TransitionContext = {}
): TransitionResult {
  if (!canTransition(from, to)) return { ok: false, error: "invalid_transition" };
  if (to === "cuir_assigned") {
    if (ctx.repositoryMode !== "external") return { ok: false, error: "sandbox_cannot_assign_cuir" };
    if (!isAcceptableOfficialCuir(ctx.cuir)) return { ok: false, error: "cuir_required" };
  }
  return { ok: true, to };
}

export const NATIONAL_RX_STATE_LABELS: Record<NationalRxState, string> = {
  issued_local: "Receta local emitida",
  professional_validation_pending: "Validando profesional (REFEPS)…",
  professional_validated: "Profesional validado",
  professional_validation_failed: "Validación REFEPS fallida",
  repository_submission_pending: "Enviando al repositorio…",
  repository_submitted: "Registrada en repositorio",
  repository_submission_failed: "Envío rechazado",
  repository_unavailable: "Repositorio no disponible",
  cuir_assigned: "CUIR asignado",
  cuir_verification_failed: "Verificación de CUIR fallida",
  cancelled: "Anulada",
};
