"use server";

import { revalidatePath } from "next/cache";

import {
  challengeAndVerifyPrescriberTotp,
  getPrescriberMfaStatus,
  startPrescriberTotpEnrollment,
  verifyPrescriberTotpEnrollment,
} from "@/core/auth/prescriber-mfa.server";
import { getActiveClinic, getSession } from "@/core/auth/session.server";
import { hasPermission } from "@/core/permissions/roles";
import {
  isRefepsValidationStatus,
  type RefepsValidationStatus,
  validatePrescriber,
} from "@/core/renapdis";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

export type ProfessionalVerificationRow = {
  id: string;
  displayName: string;
  cuil: string | null;
  taxId: string | null;
  licenseNumber: string | null;
  licenseNational: string | null;
  licenseProvincial: string | null;
  licensingJurisdiction: string | null;
  issuingAuthority: string | null;
  specialty: string | null;
  refepsIdentifier: string | null;
  refepsValidationStatus: RefepsValidationStatus;
  refepsValidatedAt: string | null;
  refepsValidationError: string | null;
};

export type ProfessionalVerificationPanelData = {
  professionals: ProfessionalVerificationRow[];
  mfa: Awaited<ReturnType<typeof getPrescriberMfaStatus>>;
  canManage: boolean;
  canPrescribe: boolean;
};

function specialtyFromJoin(
  specialties: { name?: string } | { name?: string }[] | null | undefined,
  fallback: string | null
): string | null {
  if (Array.isArray(specialties)) return specialties[0]?.name ?? fallback;
  return specialties?.name ?? fallback;
}

export async function loadProfessionalVerificationPanel(): Promise<
  { data: ProfessionalVerificationPanelData } | { error: string }
> {
  const [user, active] = await Promise.all([getSession(), getActiveClinic()]);
  const clinicId = active.clinic?.id;
  if (!user || !clinicId) return { error: "Sesión requerida." };

  const canManage = hasPermission(active.role, "manageStaff", active.isSuperadmin);
  const canPrescribe = hasPermission(active.role, "issuePrescriptions", active.isSuperadmin);
  if (!canManage && !canPrescribe) {
    return { error: "Sin permisos para ver verificación de profesionales." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("professionals")
    .select(
      "id, display_name, cuil, tax_id, license_number, license_national, license_provincial, licensing_jurisdiction, issuing_authority, refeps_specialty, refeps_identifier, refeps_validation_status, refeps_validated_at, refeps_validation_error, specialties(name)"
    )
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .order("display_name");

  if (error) return { error: error.message };

  const mfa = await getPrescriberMfaStatus();

  const professionals: ProfessionalVerificationRow[] = (data ?? []).map((row) => {
    const statusRaw = row.refeps_validation_status;
    const status: RefepsValidationStatus = isRefepsValidationStatus(statusRaw)
      ? statusRaw
      : "not_configured";
    return {
      id: row.id,
      displayName: row.display_name,
      cuil: row.cuil,
      taxId: row.tax_id,
      licenseNumber: row.license_number,
      licenseNational: row.license_national,
      licenseProvincial: row.license_provincial,
      licensingJurisdiction: row.licensing_jurisdiction,
      issuingAuthority: row.issuing_authority,
      specialty: specialtyFromJoin(
        row.specialties as { name?: string } | { name?: string }[] | null,
        row.refeps_specialty
      ),
      refepsIdentifier: row.refeps_identifier,
      refepsValidationStatus: status,
      refepsValidatedAt: row.refeps_validated_at,
      refepsValidationError: row.refeps_validation_error,
    };
  });

  return {
    data: {
      professionals,
      mfa,
      canManage,
      canPrescribe,
    },
  };
}

export async function updateProfessionalRenapdisIdentity(formData: FormData): Promise<
  { success: true; message: string } | { error: string }
> {
  const [user, active] = await Promise.all([getSession(), getActiveClinic()]);
  const clinicId = active.clinic?.id;
  if (!user || !clinicId) return { error: "Sesión requerida." };
  if (!hasPermission(active.role, "manageStaff", active.isSuperadmin)) {
    return { error: "Solo administración puede editar identidad REFEPS." };
  }

  const idParsed = parseEntityId(String(formData.get("professional_id") ?? ""), "Profesional");
  if (!idParsed.ok) return { error: idParsed.error };

  const cuil = String(formData.get("cuil") ?? "").trim() || null;
  const refepsIdentifier = String(formData.get("refeps_identifier") ?? "").trim() || null;
  const licenseNumber = String(formData.get("license_number") ?? "").trim() || null;
  const licensingJurisdiction =
    String(formData.get("licensing_jurisdiction") ?? "").trim() || null;
  const issuingAuthority = String(formData.get("issuing_authority") ?? "").trim() || null;
  const refepsSpecialty = String(formData.get("refeps_specialty") ?? "").trim() || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("professionals")
    .update({
      cuil,
      refeps_identifier: refepsIdentifier,
      license_number: licenseNumber,
      licensing_jurisdiction: licensingJurisdiction,
      issuing_authority: issuingAuthority,
      refeps_specialty: refepsSpecialty,
      refeps_validation_status: "not_configured",
      refeps_validation_error: null,
      refeps_validated_at: null,
      refeps_validation_details: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  revalidatePath("/configuracion");
  revalidatePath("/ingreso-profesionales");
  return { success: true, message: "Identidad profesional actualizada. Ejecutá validación REFEPS." };
}

export async function runProfessionalRefepsValidation(professionalId: string): Promise<
  { success: true; status: RefepsValidationStatus; message: string } | { error: string }
> {
  const [user, active] = await Promise.all([getSession(), getActiveClinic()]);
  const clinicId = active.clinic?.id;
  if (!user || !clinicId) return { error: "Sesión requerida." };
  if (!hasPermission(active.role, "manageStaff", active.isSuperadmin)) {
    return { error: "Solo administración puede validar profesionales." };
  }

  const idParsed = parseEntityId(professionalId, "Profesional");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const result = await validatePrescriber(supabase, {
    clinicId,
    professionalId: idParsed.data,
    actorUserId: user.id,
    preferOfficial: false,
    persist: true,
  });

  revalidatePath("/configuracion");
  revalidatePath("/ingreso-profesionales");

  if (!result.ok) {
    return { error: result.error };
  }

  return {
    success: true,
    status: result.status,
    message:
      result.status === "sandbox"
        ? "Validación sandbox OK (no es homologación oficial)."
        : `Validación OK (${result.status}).`,
  };
}

export async function enrollPrescriberMfa(): Promise<
  | { data: { factorId: string; qrCode: string; secret: string } }
  | { error: string }
> {
  const [user, active] = await Promise.all([getSession(), getActiveClinic()]);
  if (!user || !active.clinic?.id) return { error: "Sesión requerida." };
  if (!hasPermission(active.role, "issuePrescriptions", active.isSuperadmin)) {
    return { error: "MFA de prescritor solo aplica a usuarios que emiten recetas." };
  }
  const started = await startPrescriberTotpEnrollment();
  if (!started.ok) return { error: started.error };
  return { data: started };
}

export async function confirmPrescriberMfaEnrollment(input: {
  factorId: string;
  code: string;
}): Promise<{ success: true } | { error: string }> {
  const [user, active] = await Promise.all([getSession(), getActiveClinic()]);
  const clinicId = active.clinic?.id;
  if (!user || !clinicId) return { error: "Sesión requerida." };
  if (!hasPermission(active.role, "issuePrescriptions", active.isSuperadmin)) {
    return { error: "MFA de prescritor solo aplica a usuarios que emiten recetas." };
  }
  const result = await verifyPrescriberTotpEnrollment({
    factorId: input.factorId,
    code: input.code,
    clinicId,
    userId: user.id,
  });
  if (!result.ok) return { error: result.error };
  return { success: true };
}

export async function elevatePrescriberMfaSession(input: {
  factorId: string;
  code: string;
}): Promise<{ success: true } | { error: string }> {
  const [user, active] = await Promise.all([getSession(), getActiveClinic()]);
  if (!user || !active.clinic?.id) return { error: "Sesión requerida." };
  if (!hasPermission(active.role, "issuePrescriptions", active.isSuperadmin)) {
    return { error: "Sin permiso de emisión." };
  }
  const result = await challengeAndVerifyPrescriberTotp(input);
  if (!result.ok) return { error: result.error };
  return { success: true };
}
