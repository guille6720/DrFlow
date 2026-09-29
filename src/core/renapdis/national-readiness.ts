/**
 * Clinic-level readiness for national electronic prescription.
 * READY is never inferred: every dependency must actually be available.
 * Contains no secrets — only booleans, modes and missing env var NAMES.
 */

import {
  type EnvSource,
  isProductionRuntime,
  resolveRefepsValidationConfig,
  resolveRepositoryConfig,
} from "@/core/renapdis/repository/repository-config";

export type NationalRxReadiness = {
  environment: "production" | "preview" | "development";
  featureEnabled: boolean;
  productEntitled: boolean;
  establishmentConfigured: boolean;
  refepsConfigured: boolean;
  refepsMode: "official" | "sandbox" | "unavailable";
  repositoryConfigured: boolean;
  repositoryMode: "sandbox" | "external" | "not_configured";
  repositoryProviderId: string | null;
  repositoryReason: string;
  officialCredentials: boolean;
  professionalValidationAvailable: boolean;
  officialCuirAvailable: boolean;
  homologationConfirmed: boolean;
  /** Official national prescription — all of the above, official modes only. */
  readyForNationalPrescription: boolean;
  /** Staging-only end-to-end test path (sandbox REFEPS/repository, never a CUIR). */
  readyForSandboxTesting: boolean;
  blockers: string[];
};

export function resolveEnvironmentLabel(env: EnvSource): NationalRxReadiness["environment"] {
  if (isProductionRuntime(env)) return "production";
  if ((env.VERCEL_ENV ?? "").trim() === "preview") return "preview";
  return "development";
}

export function evaluateNationalRxReadiness(input: {
  featureEnabled: boolean;
  productEntitled: boolean;
  establishmentCode: string | null;
  env?: EnvSource;
}): NationalRxReadiness {
  const env = input.env ?? process.env;
  const repo = resolveRepositoryConfig(env);
  const refeps = resolveRefepsValidationConfig(env);
  const establishmentConfigured = Boolean(input.establishmentCode?.trim());
  const homologationConfirmed = (env.RENAPDIS_HOMOLOGATION_CONFIRMED ?? "").trim().toLowerCase() === "true";

  const refepsOfficial = refeps.mode === "official" && refeps.configured;
  const repoExternal = repo.mode === "external" && repo.configured;
  const officialCredentials = repoExternal && refepsOfficial;

  const blockers: string[] = [];
  if (!input.featureEnabled) blockers.push("Funcionalidad deshabilitada para la clínica");
  if (!input.productEntitled) blockers.push("Plan/producto sin acceso a recetas");
  if (!establishmentConfigured) blockers.push("Falta código de establecimiento");
  if (!refepsOfficial) blockers.push(refeps.mode === "sandbox" ? "REFEPS en modo sandbox" : "Validación REFEPS no configurada");
  if (!repoExternal) blockers.push(repo.mode === "sandbox" ? "Repositorio en modo sandbox" : "Repositorio ReNaPDiS no configurado");
  if (!homologationConfirmed) blockers.push("Homologación no confirmada");

  const base = input.featureEnabled && input.productEntitled && establishmentConfigured;

  return {
    environment: resolveEnvironmentLabel(env),
    featureEnabled: input.featureEnabled,
    productEntitled: input.productEntitled,
    establishmentConfigured,
    refepsConfigured: refeps.configured,
    refepsMode: refeps.mode,
    repositoryConfigured: repo.configured,
    repositoryMode: repo.mode,
    repositoryProviderId: repo.providerId,
    repositoryReason: repo.reason,
    officialCredentials,
    professionalValidationAvailable: refeps.configured,
    officialCuirAvailable: repoExternal,
    homologationConfirmed,
    readyForNationalPrescription: base && officialCredentials && homologationConfirmed,
    readyForSandboxTesting: base && !isProductionRuntime(env) && refeps.configured && repo.configured,
    blockers,
  };
}
