/**
 * Safe degradation when REFEPS / ReNaPDiS / Ministry / terminology services are unavailable.
 * Never fail-open for national legal validation.
 */

export type ExternalDependencyId =
  | "refeps"
  | "renapdis"
  | "dnsisa"
  | "terminology";

export type ExternalDependencyStatus = {
  id: ExternalDependencyId;
  available: boolean;
  reason: string | null;
};

export function isRefepsForcedOutage(): boolean {
  const raw = process.env.REFEPS_FORCE_OUTAGE?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function getRefepsDependencyStatus(): ExternalDependencyStatus {
  if (isRefepsForcedOutage()) {
    return {
      id: "refeps",
      available: false,
      reason: "REFEPS_FORCE_OUTAGE enabled (fiscalization / outage drill).",
    };
  }
  return { id: "refeps", available: true, reason: null };
}

export type NationalSubmitOutageResult = {
  ok: false;
  error: string;
  code: "external_dependency_outage";
  nationalRxStatus: "failed";
  /** Explicit: must never imply Ministry acceptance. */
  legalValidity: "none";
};

export function nationalSubmitBlockedByOutage(
  dependency: ExternalDependencyStatus
): NationalSubmitOutageResult | null {
  if (dependency.available) return null;
  return {
    ok: false,
    error:
      dependency.reason ??
      "Servicio externo de receta nacional no disponible. La receta no se marca como enviada.",
    code: "external_dependency_outage",
    nationalRxStatus: "failed",
    legalValidity: "none",
  };
}

/** UI / audit safe message — no PHI. */
export function externalOutageUserMessage(dependency: ExternalDependencyId): string {
  switch (dependency) {
    case "refeps":
    case "renapdis":
    case "dnsisa":
      return "El servicio nacional de receta electrónica no está disponible. Podés continuar con flujos locales; el envío nacional queda pendiente/fallido.";
    case "terminology":
      return "El servicio de terminología no está disponible. Se conserva el texto libre sin codificar.";
    default:
      return "Dependencia externa no disponible.";
  }
}
