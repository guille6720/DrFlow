"use server";

import { revalidatePath } from "next/cache";
import { getActiveClinic, getActiveClinicId } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions/roles";
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
  const custom = customRaw
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const accepted = normalizeCoverages([...selected, ...custom]);

  if (accepted.length === 0) {
    return { error: "Seleccioná al menos una cobertura o agregá una personalizada." };
  }

  let defaultInsurance = String(formData.get("default_insurance") ?? "").trim();
  if (!defaultInsurance || !accepted.some((c) => c.toLowerCase() === defaultInsurance.toLowerCase())) {
    defaultInsurance = accepted[0];
  } else {
    // Usar la forma canónica del array
    defaultInsurance =
      accepted.find((c) => c.toLowerCase() === defaultInsurance.toLowerCase()) ?? accepted[0];
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("clinics")
    .update({
      accepted_coverages: accepted,
      default_insurance_provider: defaultInsurance,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clinicId);

  if (error) {
    if (error.message?.includes("accepted_coverages")) {
      return {
        error: "Ejecutá la migración 030 en Supabase SQL Editor (030_clinic_accepted_coverages.sql).",
      };
    }
    return { error: error.message || "No se pudieron guardar las coberturas." };
  }

  revalidatePath("/configuracion");
  revalidatePath("/pacientes");
  revalidatePath("/pacientes/nuevo");

  return {
    success: true,
    message: `Coberturas guardadas (${accepted.length}). Por defecto: ${defaultInsurance}.`,
  };
}
