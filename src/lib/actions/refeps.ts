"use server";

import { revalidatePath } from "next/cache";

import { requireSettingsAccess } from "@/core/actions/clinic-guard";
import {
  getRefepsConfigurationHint,
  isRefepsApiConfigured,
  resolveRefepsSubmissionMode,
} from "@/core/refeps/provider";
import { loadClinicRefepsRow } from "@/core/refeps/submission-service";
import { submitNationalPrescriptionForSession } from "@/core/renapdis/national-prescription/national-prescription.server";
import { recordAuditChange } from "@/core/security/audit-service";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

export type RefepsClinicSettingsView = {
  enabled: boolean;
  establishmentCode: string | null;
  autoSubmit: boolean;
  apiConfigured: boolean;
  submissionMode: ReturnType<typeof resolveRefepsSubmissionMode>;
  configurationHint: string;
};

export async function getRefepsClinicSettings(): Promise<
  { data: RefepsClinicSettingsView } | { error: string }
> {
  const access = await requireSettingsAccess();
  if (access.error || !access.clinicId) {
    return { error: access.error ?? "Sin permisos para ver configuración REFEPS." };
  }

  const row = await loadClinicRefepsRow(await createClient(), access.clinicId);
  if (!row) return { error: "Consultorio no encontrado." };

  return {
    data: {
      enabled: row.refeps_enabled,
      establishmentCode: row.refeps_establishment_code,
      autoSubmit: row.refeps_auto_submit,
      apiConfigured: isRefepsApiConfigured(),
      submissionMode: resolveRefepsSubmissionMode(),
      configurationHint: getRefepsConfigurationHint(),
    },
  };
}

export async function updateRefepsClinicSettings(formData: FormData): Promise<{
  success?: boolean;
  error?: string;
  message?: string;
}> {
  const access = await requireSettingsAccess();
  if (access.error || !access.clinicId) {
    return { error: access.error ?? "Sin permisos para editar REFEPS." };
  }

  const enabled = formData.get("refeps_enabled") === "on" || formData.get("refeps_enabled") === "true";
  const autoSubmit =
    formData.get("refeps_auto_submit") === "on" || formData.get("refeps_auto_submit") === "true";
  const establishmentCode = String(formData.get("refeps_establishment_code") ?? "").trim() || null;

  if (enabled && !establishmentCode) {
    return { error: "Ingresá el código de establecimiento REFEPS para habilitar el envío." };
  }

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("clinics")
    .select("refeps_enabled, refeps_establishment_code, refeps_auto_submit")
    .eq("id", access.clinicId)
    .single();

  const { error } = await supabase
    .from("clinics")
    .update({
      refeps_enabled: enabled,
      refeps_establishment_code: establishmentCode,
      refeps_auto_submit: autoSubmit,
      updated_at: new Date().toISOString(),
    })
    .eq("id", access.clinicId);

  if (error) return { error: error.message || "No se pudo guardar la configuración REFEPS." };

  await recordAuditChange({
    clinicId: access.clinicId,
    module: "settings",
    entityType: "clinic",
    entityId: access.clinicId,
    action: "update",
    what: "Actualizó integración REFEPS",
    before: before ?? null,
    after: {
      refeps_enabled: enabled,
      refeps_establishment_code: establishmentCode,
      refeps_auto_submit: autoSubmit,
    },
    keys: ["refeps_enabled", "refeps_establishment_code", "refeps_auto_submit"],
  });

  revalidatePath("/configuracion");

  return {
    success: true,
    message: enabled
      ? "Configuración guardada. El envío nacional solo ocurre si la funcionalidad está habilitada y la integración está lista (REFEPS + repositorio ReNaPDiS). No implica homologación."
      : "Envío nacional desactivado — las recetas siguen emitiéndose como recetas locales.",
  };
}

/**
 * @deprecated Kept for existing callers. Delegates to the national flow
 * (REFEPS validation → ReNaPDiS repository), which enforces RBAC, plan, feature flag, MFA and readiness.
 */
export async function submitPrescriptionToRefeps(prescriptionId: string): Promise<{ error?: string; data?: null }> {
  const idParsed = parseEntityId(prescriptionId, "Receta");
  if (!idParsed.ok) return { error: idParsed.error };
  const result = await submitNationalPrescriptionForSession(idParsed.data);
  return result.ok ? { data: null } : { error: result.message };
}
