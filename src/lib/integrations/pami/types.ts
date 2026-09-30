/**
 * PAMI integration contracts.
 *
 * Phase 1 only opens the official PAMI entry pages in a new tab. There are NO PAMI endpoints, SSO flows,
 * payloads or credentials in this codebase.
 * TODO: Replace external launch with official PAMI integration only if PAMI provides documented API, SSO,
 * or deep-link specifications.
 */

import type { RctaPatientContext } from "@/lib/integrations/rcta/types";

export type PamiDocumentKind = "prescription" | "medical_order";

/** Launch surface. Implementations must never pass patient data to PAMI. */
export interface PamiIntegration {
  readonly mode: "external_link";
  openPrescription(): void;
  openMedicalOrder(): void;
}

export type PamiAccess = {
  prescriptions: boolean;
  medicalOrders: boolean;
};

/** Read-only patient data shown to the clinician to copy manually into PAMI. */
export type PamiPatientContext = RctaPatientContext & {
  cuil: string | null;
  /** Display format, e.g. "20-12345678-3". */
  cuilFormatted: string | null;
  /** Normalized coverage detection (UI emphasis only; never clinical eligibility). */
  pamiCoverage: boolean;
};

export type PamiLaunchContextResult =
  | {
      ok: true;
      prescriptionUrl: string;
      medicalOrderUrl: string;
      access: PamiAccess;
      patient: PamiPatientContext;
    }
  | { ok: false; reason: "invalid_patient" | "unauthenticated" | "not_allowed" | "not_found" };
