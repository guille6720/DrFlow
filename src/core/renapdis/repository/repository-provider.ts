import type {
  CancelPrescriptionResponse,
  CuirStatusResponse,
  CuirVerificationResponse,
  NationalPrescriptionRequest,
  NationalPrescriptionResponse,
  RepositoryCallContext,
  RepositoryProviderMode,
} from "@/core/renapdis/repository/repository-types";

/**
 * Contract every ReNaPDiS-compatible repository adapter implements.
 * Business logic depends only on this interface — never on a vendor schema.
 * Implementations throw `RepositoryProviderError` for every failure.
 */
export interface PrescriptionRepositoryProvider {
  readonly id: string;
  readonly mode: RepositoryProviderMode;
  submitPrescription(
    request: NationalPrescriptionRequest,
    ctx: RepositoryCallContext
  ): Promise<NationalPrescriptionResponse>;
  getPrescriptionStatus(
    repositoryPrescriptionId: string,
    ctx: RepositoryCallContext
  ): Promise<CuirStatusResponse>;
  verifyCuir(cuir: string, ctx: RepositoryCallContext): Promise<CuirVerificationResponse>;
  cancelPrescription(
    repositoryPrescriptionId: string,
    reasonCode: string,
    ctx: RepositoryCallContext
  ): Promise<CancelPrescriptionResponse>;
}
