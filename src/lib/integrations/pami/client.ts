/**
 * PAMI launcher (phase 1: external link to the official entry pages).
 *
 * Only the validated configured URL is opened. No patient data, credentials or tokens are ever passed,
 * and NexClinic never automates CUP/PAMI login, OTP or form filling.
 */

import { PAMI_LINK_TARGET, PAMI_OME_URL, PAMI_PRESCRIPTION_URL } from "@/lib/integrations/pami/config";
import type { PamiDocumentKind, PamiIntegration } from "@/lib/integrations/pami/types";

export function getPamiLaunchUrl(
  kind: PamiDocumentKind,
  urls: { prescription: string; medicalOrder: string } = {
    prescription: PAMI_PRESCRIPTION_URL,
    medicalOrder: PAMI_OME_URL,
  }
): string {
  return kind === "prescription" ? urls.prescription : urls.medicalOrder;
}

type WindowOpener = (url: string, target: string, features: string) => unknown;

const defaultOpener: WindowOpener = (url, target, features) => window.open(url, target, features);

export function createExternalPamiIntegration(open: WindowOpener = defaultOpener): PamiIntegration {
  const launch = (kind: PamiDocumentKind) => {
    open(getPamiLaunchUrl(kind), PAMI_LINK_TARGET, "noopener,noreferrer");
  };
  return {
    mode: "external_link",
    openPrescription: () => launch("prescription"),
    openMedicalOrder: () => launch("medical_order"),
  };
}

export function openPamiPrescription(open: WindowOpener = defaultOpener): void {
  createExternalPamiIntegration(open).openPrescription();
}

export function openPamiMedicalOrder(open: WindowOpener = defaultOpener): void {
  createExternalPamiIntegration(open).openMedicalOrder();
}
