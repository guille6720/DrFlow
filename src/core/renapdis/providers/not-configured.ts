import {
  type RepositoryErrorCode,
  RepositoryProviderError,
} from "@/core/renapdis/repository/repository-errors";
import type { PrescriptionRepositoryProvider } from "@/core/renapdis/repository/repository-provider";

/** Fail-closed provider: every operation throws, nothing is ever registered. */
export function createNotConfiguredProvider(
  code: Extract<RepositoryErrorCode, "not_configured" | "unknown_provider" | "missing_credentials">
): PrescriptionRepositoryProvider {
  const fail = async (): Promise<never> => {
    throw new RepositoryProviderError(code);
  };
  return {
    id: "not-configured",
    mode: "not_configured",
    submitPrescription: fail,
    getPrescriptionStatus: fail,
    verifyCuir: fail,
    cancelPrescription: fail,
  };
}
