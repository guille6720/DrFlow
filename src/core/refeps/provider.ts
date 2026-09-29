import "server-only";

import { resolveRefepsValidationConfig } from "@/core/renapdis/repository/repository-config";

/**
 * REFEPS = professional validation only. Prescription registration and CUIR belong to the
 * ReNaPDiS repository layer (`src/core/renapdis/repository`). The former generic
 * `POST {REFEPS_API_URL}/prescriptions` submission was removed: REFEPS is not a prescription repository.
 */

export type RefepsValidationModeView = "sandbox" | "api" | "unavailable";

/** True when REFEPS validation credentials are present (REFEPS_VALIDATION_* or legacy REFEPS_API_*). */
export function isRefepsApiConfigured(): boolean {
  const url = process.env.REFEPS_VALIDATION_API_URL?.trim() || process.env.REFEPS_API_URL?.trim();
  const key = process.env.REFEPS_VALIDATION_API_KEY?.trim() || process.env.REFEPS_API_KEY?.trim();
  return Boolean(url && key);
}

export function resolveRefepsSubmissionMode(): RefepsValidationModeView {
  const config = resolveRefepsValidationConfig();
  if (config.mode === "sandbox") return "sandbox";
  if (isRefepsApiConfigured()) return "api";
  return "unavailable";
}

export function getRefepsConfigurationHint(): string {
  return (
    "La validación de profesionales usa REFEPS_VALIDATION_API_URL / REFEPS_VALIDATION_API_KEY " +
    "(compatibilidad: REFEPS_API_URL / REFEPS_API_KEY). El registro de la receta y el CUIR los provee " +
    "un repositorio ReNaPDiS homologado (RENAPDIS_REPOSITORY_*), no REFEPS."
  );
}

export {
  REFEPS_SANDBOX_DISCLAIMER,
  REFEPS_SUBMITTED_DISCLAIMER,
} from "@/core/compliance/prescription-compliance";
