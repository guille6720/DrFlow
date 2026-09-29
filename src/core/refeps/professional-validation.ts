/**
 * REFEPS professional validation — ONLY answers "is this professional registered and active?".
 * It never registers prescriptions (that is the ReNaPDiS repository's job).
 *
 * The official REFEPS lookup contract is not available yet, so official mode reports
 * `unavailable`. Sandbox mode is explicit (REFEPS_VALIDATION_MODE=sandbox, never in production)
 * and every sandbox result carries `mode: "sandbox"` so it cannot unlock an official submission.
 */

import {
  type EnvSource,
  resolveRefepsValidationConfig,
} from "@/core/renapdis/repository/repository-config";

export type RefepsProfessionalValidationInput = {
  documentNumber: string | null;
  licenseNumber: string | null;
  profession: string | null;
  jurisdiction: string | null;
};

export type RefepsProfessionalValidationStatus = "validated" | "not_found" | "inactive" | "unavailable";

export type ProfessionalValidationResponse = {
  valid: boolean;
  status: RefepsProfessionalValidationStatus;
  /** "sandbox" results are test-only and never authorize an official repository submission. */
  mode: "official" | "sandbox" | "unavailable";
  professionalId?: string;
  validatedAt?: string;
  reason?:
    | "not_configured"
    | "official_adapter_not_implemented"
    | "sandbox_blocked_in_production"
    | "incomplete_identity"
    | "forced_outage";
};

function isForcedOutage(env: EnvSource): boolean {
  const raw = env.REFEPS_FORCE_OUTAGE?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

/** Pluggable official client — registered once REFEPS publishes the lookup contract and credentials exist. */
export interface OfficialRefepsValidationClient {
  lookup(input: RefepsProfessionalValidationInput, signal: AbortSignal): Promise<ProfessionalValidationResponse>;
}

export async function validateProfessionalWithRefeps(
  input: RefepsProfessionalValidationInput,
  options: { env?: EnvSource; now?: () => Date; officialClient?: OfficialRefepsValidationClient | null } = {}
): Promise<ProfessionalValidationResponse> {
  const env = options.env ?? process.env;
  if (isForcedOutage(env)) {
    return { valid: false, status: "unavailable", mode: "unavailable", reason: "forced_outage" };
  }
  const config = resolveRefepsValidationConfig(env);
  const now = options.now ?? (() => new Date());

  if (options.officialClient && config.reason === "official_adapter_not_implemented") {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const result = await options.officialClient.lookup(input, controller.signal);
      return result.mode === "official" ? result : { valid: false, status: "unavailable", mode: "unavailable" };
    } catch {
      return { valid: false, status: "unavailable", mode: "unavailable" };
    } finally {
      clearTimeout(timer);
    }
  }

  if (config.mode === "sandbox") {
    const complete = Boolean(input.documentNumber?.trim() && input.licenseNumber?.trim());
    if (!complete) {
      return { valid: false, status: "not_found", mode: "sandbox", reason: "incomplete_identity" };
    }
    return { valid: true, status: "validated", mode: "sandbox", validatedAt: now().toISOString() };
  }

  return {
    valid: false,
    status: "unavailable",
    mode: "unavailable",
    reason:
      config.reason === "official_adapter_not_implemented"
        ? "official_adapter_not_implemented"
        : config.reason === "sandbox_blocked_in_production"
          ? "sandbox_blocked_in_production"
          : "not_configured",
  };
}
