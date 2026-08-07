import { pamiSetupMessages } from "@/locales/es-AR/pami/setup";

export type PamiCabeceraSeedResult = {
  clinic_id?: string;
  already_configured?: boolean;
  changed?: boolean;
  templates_added?: number;
  reasons_added?: number;
  templates_present?: number;
  reasons_present?: number;
  default_insurance?: string;
  slot_minutes?: number;
};

export function parsePamiCabeceraSeedResult(data: unknown): PamiCabeceraSeedResult {
  if (data == null || typeof data !== "object") return {};
  return data as PamiCabeceraSeedResult;
}

/** True when the RPC mutated clinic metadata or inserted missing seed rows. */
export function pamiCabeceraSeedChanged(result: PamiCabeceraSeedResult): boolean {
  if (typeof result.changed === "boolean") return result.changed;
  return (result.templates_added ?? 0) > 0 || (result.reasons_added ?? 0) > 0;
}

export function formatPamiCabeceraSuccessMessage(result: PamiCabeceraSeedResult): string {
  const { seed } = pamiSetupMessages;
  const templatesAdded = result.templates_added ?? 0;
  const reasonsAdded = result.reasons_added ?? 0;

  if (result.already_configured && !pamiCabeceraSeedChanged(result)) {
    return seed.alreadyConfigured;
  }

  if (templatesAdded === 0 && reasonsAdded === 0) {
    return seed.profileUpdated;
  }

  const parts: string[] = [seed.readyPrefix];
  if (templatesAdded > 0) {
    parts.push(seed.templatesAdded(templatesAdded));
  }
  if (reasonsAdded > 0) {
    parts.push(seed.reasonsAdded(reasonsAdded));
  }
  parts.push(seed.slotMinutes, seed.defaultCoverage);

  return `${parts[0]}: ${parts.slice(1).join(", ")}.`;
}
