import "server-only";

import type { PrescriberMfaStatus } from "@/core/auth/prescriber-mfa.types";
import { recordAudit } from "@/core/security/audit-service";
import { createClient } from "@/core/supabase/server";

export type { PrescriberMfaStatus } from "@/core/auth/prescriber-mfa.types";

export type PrescriberMfaGateResult =
  | { ok: true; status: PrescriberMfaStatus }
  | { ok: false; error: string; code: "mfa_missing" | "mfa_not_elevated"; status: PrescriberMfaStatus };

/**
 * Reads Supabase Auth MFA (TOTP) assurance — no custom cryptography.
 */
export async function getPrescriberMfaStatus(): Promise<PrescriberMfaStatus> {
  const supabase = await createClient();
  const [{ data: aalData, error: aalError }, { data: factorsData }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);

  if (aalError) {
    return {
      enrolled: false,
      currentLevel: "aal1",
      nextLevel: null,
      elevated: false,
      factorCount: 0,
      factors: [],
    };
  }

  const totpFactors = factorsData?.totp ?? [];
  const verified = totpFactors.filter((f) => f.status === "verified");
  const currentLevel = aalData?.currentLevel ?? "aal1";
  const nextLevel = aalData?.nextLevel ?? null;

  return {
    enrolled: verified.length > 0,
    currentLevel,
    nextLevel,
    elevated: currentLevel === "aal2",
    factorCount: verified.length,
    factors: verified.map((f) => ({
      id: f.id,
      friendlyName: f.friendly_name ?? null,
    })),
  };
}

/**
 * Elevated (AAL2) session required before issuing a prescription.
 * Users who never prescribe never hit this gate.
 */
export async function requireElevatedPrescriberSession(input?: {
  clinicId?: string;
  userId?: string;
  auditOnFail?: boolean;
}): Promise<PrescriberMfaGateResult> {
  const status = await getPrescriberMfaStatus();

  if (!status.enrolled) {
    if (input?.auditOnFail !== false && input?.clinicId && input?.userId) {
      await recordAudit({
        clinicId: input.clinicId,
        module: "compliance",
        entityType: "prescription",
        action: "view",
        what: "Emisión de receta bloqueada: MFA no enrolado",
        userId: input.userId,
        metadata: {
          event: "prescription_blocked",
          reason: "mfa_missing",
        },
      });
    }
    return {
      ok: false,
      code: "mfa_missing",
      error:
        "Debés activar MFA (TOTP) antes de emitir recetas. Configuración → Profesionales.",
      status,
    };
  }

  if (!status.elevated) {
    if (input?.auditOnFail !== false && input?.clinicId && input?.userId) {
      await recordAudit({
        clinicId: input.clinicId,
        module: "compliance",
        entityType: "prescription",
        action: "view",
        what: "Emisión de receta bloqueada: sesión MFA no elevada (AAL2)",
        userId: input.userId,
        metadata: {
          event: "prescription_blocked",
          reason: "mfa_not_elevated",
        },
      });
    }
    return {
      ok: false,
      code: "mfa_not_elevated",
      error:
        "Confirmá tu segundo factor (MFA) para elevar la sesión antes de emitir la receta.",
      status,
    };
  }

  return { ok: true, status };
}

export async function startPrescriberTotpEnrollment(): Promise<
  | { ok: true; factorId: string; qrCode: string; secret: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "NexClinic prescritor",
  });
  if (error || !data) {
    return { ok: false, error: error?.message ?? "No se pudo iniciar el enrolamiento MFA." };
  }
  return {
    ok: true,
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

export async function verifyPrescriberTotpEnrollment(input: {
  factorId: string;
  code: string;
  clinicId?: string;
  userId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const challenge = await supabase.auth.mfa.challenge({ factorId: input.factorId });
  if (challenge.error || !challenge.data) {
    return { ok: false, error: challenge.error?.message ?? "No se pudo crear el desafío MFA." };
  }

  const verified = await supabase.auth.mfa.verify({
    factorId: input.factorId,
    challengeId: challenge.data.id,
    code: input.code.trim(),
  });
  if (verified.error) {
    return { ok: false, error: verified.error.message };
  }

  if (input.clinicId && input.userId) {
    await recordAudit({
      clinicId: input.clinicId,
      module: "auth",
      entityType: "user",
      entityId: input.userId,
      action: "update",
      what: "Enrolamiento MFA TOTP para prescritor",
      userId: input.userId,
      metadata: { event: "mfa_enrollment", factor_id: input.factorId },
    });
  }

  return { ok: true };
}

export async function challengeAndVerifyPrescriberTotp(input: {
  factorId: string;
  code: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const challenge = await supabase.auth.mfa.challenge({ factorId: input.factorId });
  if (challenge.error || !challenge.data) {
    return { ok: false, error: challenge.error?.message ?? "No se pudo crear el desafío MFA." };
  }
  const verified = await supabase.auth.mfa.verify({
    factorId: input.factorId,
    challengeId: challenge.data.id,
    code: input.code.trim(),
  });
  if (verified.error) {
    return { ok: false, error: verified.error.message };
  }
  return { ok: true };
}
