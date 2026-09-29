import { createHash } from "node:crypto";

import { RepositoryProviderError } from "@/core/renapdis/repository/repository-errors";
import type { PrescriptionRepositoryProvider } from "@/core/renapdis/repository/repository-provider";

export const SANDBOX_REFERENCE_PREFIX = "SBX-RNPD-";
export const SANDBOX_NOT_VALID_LABEL = "SANDBOX / TEST — NOT VALID FOR DISPENSING";

/**
 * Staging-only repository simulator.
 * - Deterministic per idempotency key (duplicate submits return the same reference).
 * - Returns a `sandboxReference` only. It has no CUIR field and can never produce one.
 * - Makes no network call.
 */
export function createSandboxRepositoryProvider(): PrescriptionRepositoryProvider {
  const referenceFor = (idempotencyKey: string) =>
    `${SANDBOX_REFERENCE_PREFIX}${createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 16).toUpperCase()}`;

  return {
    id: "sandbox",
    mode: "sandbox",
    async submitPrescription(request, ctx) {
      const reference = referenceFor(ctx.idempotencyKey);
      return {
        mode: "sandbox",
        providerId: "sandbox",
        repositoryPrescriptionId: `sandbox:${request.submissionId}`,
        providerRequestId: `sandbox-req-${ctx.correlationId.slice(0, 12)}`,
        status: "registered",
        sandboxReference: reference,
      };
    },
    async getPrescriptionStatus(repositoryPrescriptionId) {
      return {
        providerId: "sandbox",
        repositoryPrescriptionId,
        status: "registered",
        cuir: null,
        checkedAt: new Date().toISOString(),
      };
    },
    async verifyCuir() {
      throw new RepositoryProviderError("unsupported_operation");
    },
    async cancelPrescription(repositoryPrescriptionId) {
      return { providerId: "sandbox", repositoryPrescriptionId, cancelled: true };
    },
  };
}
