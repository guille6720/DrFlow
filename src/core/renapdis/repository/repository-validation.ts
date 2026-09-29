import { z } from "zod";

import { parseOfficialCuir } from "@/core/renapdis/cuir";
import { RepositoryProviderError } from "@/core/renapdis/repository/repository-errors";
import type {
  NationalPrescriptionRequest,
  NationalPrescriptionResponse,
} from "@/core/renapdis/repository/repository-types";

const nonEmpty = z.string().trim().min(1);

const requestSchema = z.object({
  submissionId: z.string().uuid(),
  prescriptionId: z.string().uuid(),
  prescriptionNumber: z.string().nullable(),
  issuedAt: z.string().datetime({ offset: true }),
  validityDays: z.number().int().min(1).max(365),
  category: nonEmpty,
  establishment: z.object({ code: nonEmpty }),
  professional: z.object({
    refepsProfessionalId: z.string().nullable(),
    documentNumber: z.string().nullable(),
    licenseNumber: nonEmpty,
    licenseJurisdiction: z.string().nullable(),
    profession: z.string().nullable(),
  }),
  patient: z
    .object({
      documentType: nonEmpty,
      documentNumber: z.string().nullable(),
      cuil: z.string().nullable(),
      firstName: nonEmpty,
      lastName: nonEmpty,
      birthDate: z.string().nullable(),
      sex: z.string().nullable(),
      coverage: z.object({ provider: z.string().nullable(), memberNumber: z.string().nullable() }).nullable(),
    })
    .refine((p) => Boolean(p.documentNumber?.trim() || p.cuil?.trim()), { message: "patient_identifier_required" }),
  diagnosis: z.object({
    code: z.string().nullable(),
    system: z.literal("CIE-10").nullable(),
    text: z.string().nullable(),
  }),
  items: z
    .array(
      z.object({
        genericName: nonEmpty,
        presentation: z.string().nullable(),
        quantity: z.number().positive(),
        posology: nonEmpty,
      })
    )
    .min(1),
});

export type RequestValidationResult =
  | { ok: true }
  | { ok: false; code: "invalid_prescription" | "invalid_patient" | "invalid_professional" | "invalid_establishment" };

/** Local pre-flight — returns only a taxonomy code (no field values). */
export function validateNationalPrescriptionRequest(request: NationalPrescriptionRequest): RequestValidationResult {
  const parsed = requestSchema.safeParse(request);
  if (parsed.success) return { ok: true };
  const first = parsed.error.issues[0]?.path[0];
  if (first === "patient") return { ok: false, code: "invalid_patient" };
  if (first === "professional") return { ok: false, code: "invalid_professional" };
  if (first === "establishment") return { ok: false, code: "invalid_establishment" };
  return { ok: false, code: "invalid_prescription" };
}

/** Official CUIR check (Anexo IV numeric, no separators, no sandbox placeholders). */
export function isAcceptableOfficialCuir(value: string | null | undefined): value is string {
  if (!value) return false;
  return parseOfficialCuir(value) !== null;
}

/**
 * Guards what a provider returned before anything is persisted.
 * - sandbox responses can never carry a CUIR (enforced by type + runtime check)
 * - external CUIR must be a well-formed official CUIR, otherwise the whole response is rejected
 */
export function assertValidProviderResponse(response: NationalPrescriptionResponse): NationalPrescriptionResponse {
  if (!response.repositoryPrescriptionId?.trim()) {
    throw new RepositoryProviderError("invalid_response");
  }
  if (response.mode === "sandbox") {
    if ("cuir" in (response as Record<string, unknown>)) throw new RepositoryProviderError("invalid_response");
    if (!response.sandboxReference.startsWith("SBX-")) throw new RepositoryProviderError("invalid_response");
    return response;
  }
  if (response.cuir !== null && !isAcceptableOfficialCuir(response.cuir)) {
    throw new RepositoryProviderError("invalid_response");
  }
  return response;
}
