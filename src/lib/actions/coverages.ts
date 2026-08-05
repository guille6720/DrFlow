"use server";

import { revalidatePath } from "next/cache";

import { getActiveClinic, getActiveClinicId } from "@/core/auth/session.server";
import { hasPermission } from "@/core/permissions/roles";
import { recordAuditChange } from "@/core/security/audit-service";
import { createClient } from "@/core/supabase/server";
import { firstZodIssue } from "@/core/validations/params";
import { clinicCoveragesSchema } from "@/core/validations/settings-schemas";

import { normalizeCoverages } from "@/lib/constants/coverages";

export async function updateClinicCoverages(formData: FormData): Promise<{
  success?: boolean;
  error?: string;
  message?: string;
}> {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!clinicId || !hasPermission(role, "manageSettings", isSuperadmin)) {
    return { error: "Sin permisos para editar configuración." };
  }

  const selected = formData.getAll("coverages").map((v) => String(v));
  const customRaw = String(formData.get("custom_coverages") ?? "");
  const defaultInsurance = String(formData.get("default_insurance") ?? "").trim();

  const parsed = clinicCoveragesSchema.safeParse({
    coverages: selected,
    custom_coverages: customRaw,
    default_insurance: defaultInsurance || undefined,
  });
  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const custom = parsed.data.custom_coverages
    ? parsed.data.custom_coverages
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const accepted = normalizeCoverages([...parsed.data.coverages, ...custom]);

  if (accepted.length === 0) {
    return { error: "Seleccioná al menos una cobertura o agregá una personalizada." };
  }

  let resolvedDefault = parsed.data.default_insurance?.trim() ?? "";
  if (!resolvedDefault || !accepted.some((c) => c.toLowerCase() === resolvedDefault.toLowerCase())) {
    resolvedDefault = accepted[0];
  } else {
    resolvedDefault =
      accepted.find((c) => c.toLowerCase() === resolvedDefault.toLowerCase()) ?? accepted[0];
  }

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("clinics")
    .select("accepted_coverages, default_insurance_provider")
    .eq("id", clinicId)
    .single();

  const { error } = await supabase
    .from("clinics")
    .update({
      accepted_coverages: accepted,
      default_insurance_provider: resolvedDefault,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clinicId);

  if (error) {
    if (error.message?.includes("accepted_coverages")) {
      return {
        error: "No se pudo guardar coberturas. Actualizá la configuración de la clínica o contactá soporte.",
      };
    }
    return { error: error.message || "No se pudieron guardar las coberturas." };
  }

  await recordAuditChange({
    clinicId,
    module: "settings",
    entityType: "clinic",
    entityId: clinicId,
    action: "update",
    what: "Actualizó coberturas aceptadas",
    before: before ?? null,
    after: {
      accepted_coverages: accepted,
      default_insurance_provider: resolvedDefault,
    },
    keys: ["accepted_coverages", "default_insurance_provider"],
  });

  revalidatePath("/configuracion");
  revalidatePath("/pacientes");
  revalidatePath("/pacientes/nuevo");

  return {
    success: true,
    message: `Coberturas guardadas (${accepted.length}). Por defecto: ${resolvedDefault}.`,
  };
}
