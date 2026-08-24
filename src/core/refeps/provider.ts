import "server-only";

import {
  buildUnsignedRefepsPayload,
  validateRefepsSubmissionPrerequisites,
} from "@/core/refeps/payload";
import type {
  RefepsClinicContext,
  RefepsClinicSettings,
  RefepsPatientContext,
  RefepsProfessionalContext,
  RefepsSubmissionMode,
  RefepsSubmitResult,
} from "@/core/refeps/types";

import type { ElectronicPrescription } from "@/types/prescription";

const REFEPS_API_TIMEOUT_MS = 20_000;

export function isRefepsApiConfigured(): boolean {
  return Boolean(process.env.REFEPS_API_URL?.trim() && process.env.REFEPS_API_KEY?.trim());
}

export function resolveRefepsSubmissionMode(): RefepsSubmissionMode {
  if (isRefepsApiConfigured()) return "api";
  return "sandbox";
}

export function getRefepsConfigurationHint(): string {
  return "Configurá REFEPS_API_URL y REFEPS_API_KEY en Vercel cuando la clínica tenga homologación MSN.";
}

async function submitViaApi(payload: ReturnType<typeof buildUnsignedRefepsPayload>["payload"]): Promise<{
  refepsId: string;
  verificationUrl?: string | null;
}> {
  const baseUrl = process.env.REFEPS_API_URL!.trim().replace(/\/$/, "");
  const apiKey = process.env.REFEPS_API_KEY!.trim();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REFEPS_API_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/prescriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(body || `REFEPS API respondió HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      id?: string;
      refeps_id?: string;
      verification_url?: string | null;
    };

    const refepsId = data.refeps_id ?? data.id;
    if (!refepsId?.trim()) {
      throw new Error("REFEPS API no devolvió identificador de receta.");
    }

    return { refepsId: refepsId.trim(), verificationUrl: data.verification_url ?? null };
  } finally {
    clearTimeout(timeout);
  }
}

function submitViaSandbox(payload: ReturnType<typeof buildUnsignedRefepsPayload>["payload"]): {
  refepsId: string;
  verificationUrl: null;
} {
  const suffix = payload.prescription.id.replace(/-/g, "").slice(0, 12).toUpperCase();
  return {
    refepsId: `REFEPS-SBX-${suffix}`,
    verificationUrl: null,
  };
}

export async function submitPrescriptionToRefepsProvider(input: {
  clinic: RefepsClinicContext;
  clinicSettings: RefepsClinicSettings;
  professional: RefepsProfessionalContext;
  patient: RefepsPatientContext;
  prescription: ElectronicPrescription;
}): Promise<RefepsSubmitResult> {
  const validationError = validateRefepsSubmissionPrerequisites({
    prescription: input.prescription,
    professional: input.professional,
    patient: input.patient,
    clinicSettings: input.clinicSettings,
  });
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const mode = resolveRefepsSubmissionMode();
  const { payload, signatureHash } = buildUnsignedRefepsPayload({
    mode,
    clinic: input.clinic,
    professional: input.professional,
    patient: input.patient,
    prescription: input.prescription,
  });

  try {
    const result = mode === "api" ? await submitViaApi(payload) : submitViaSandbox(payload);
    return {
      ok: true,
      refepsId: result.refepsId,
      mode,
      verificationUrl: result.verificationUrl,
      payload,
      signatureHash,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al enviar a REFEPS.";
    return { ok: false, error: message };
  }
}

export {
  REFEPS_SANDBOX_DISCLAIMER,
  REFEPS_SUBMITTED_DISCLAIMER,
} from "@/core/compliance/prescription-compliance";
