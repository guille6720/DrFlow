"use server";

import { revalidatePath } from "next/cache";

import { requireSettingsAccess } from "@/core/actions/clinic-guard";
import { requireElevatedPrescriberSession } from "@/core/auth/prescriber-mfa.server";
import { revalidatePrescriptionSurfaces } from "@/core/cache/revalidate-prescription-surfaces";
import {
  getRefepsConfigurationHint,
  isRefepsApiConfigured,
  resolveRefepsSubmissionMode,
} from "@/core/refeps/provider";
import {
  loadClinicRefepsRow,
  submitIssuedPrescriptionToRefeps,
} from "@/core/refeps/submission-service";
import { recordAuditChange } from "@/core/security/audit-service";
import { requireClinicalIssueAccess } from "@/core/services/clinical-access.service";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

import { PRESCRIPTION_ISSUE_COLUMNS } from "@/features/recetas/repositories/prescription-drafts.repository";

import { toElectronicPrescription } from "@/types/prescription";

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
      ? autoSubmit
        ? "REFEPS habilitado — envío al emitir vía adapter (sandbox o API). No implica homologación MSN automática."
        : "REFEPS habilitado — envío manual desde cada receta emitida (adapter). No implica homologación MSN automática."
      : "REFEPS deshabilitado — las recetas quedan en modo local / borrador.",
  };
}

export async function submitPrescriptionToRefeps(prescriptionId: string) {
  const access = await requireClinicalIssueAccess();
  if (!access.ok) return { error: access.error };

  const mfa = await requireElevatedPrescriberSession({
    clinicId: access.data.clinicId,
    userId: access.data.userId,
  });
  if (!mfa.ok) return { error: mfa.error };

  const idParsed = parseEntityId(prescriptionId, "Receta");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const { data: prescription, error } = await supabase
    .from("prescription_drafts")
    .select(PRESCRIPTION_ISSUE_COLUMNS)
    .eq("id", idParsed.data)
    .eq("clinic_id", access.data.clinicId)
    .eq("status", "issued")
    .maybeSingle();

  if (error || !prescription) {
    return { error: "Receta emitida no encontrada." };
  }

  if (prescription.refeps_status === "submitted") {
    return { error: "Esta receta ya fue registrada en REFEPS." };
  }

  const mapped = toElectronicPrescription(prescription);
  if (!mapped) {
    return { error: "Receta emitida con formato inválido." };
  }

  const result = await submitIssuedPrescriptionToRefeps(supabase, {
    clinicId: access.data.clinicId,
    userId: access.data.userId,
    prescription: mapped,
  });

  if (!result.ok) {
    revalidatePrescriptionSurfaces({
      patientId: prescription.patient_id,
      clinicalRecordId: prescription.clinical_record_id,
    });
    return { error: result.error, data: result.data ?? null };
  }

  revalidatePrescriptionSurfaces({
    patientId: prescription.patient_id,
    clinicalRecordId: prescription.clinical_record_id,
  });
  return { data: result.data };
}
