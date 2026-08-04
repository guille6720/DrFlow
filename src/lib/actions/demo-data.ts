"use server";

import { revalidatePath } from "next/cache";
import { requireClinicPermission } from "@/lib/actions/clinic-guard";
import { createClient } from "@/lib/supabase/server";

export type DemoSeedResult = {
  success?: boolean;
  error?: string;
  message?: string;
};

export async function seedDemoPatientsForActiveClinic(): Promise<DemoSeedResult> {
  const access = await requireClinicPermission("manageClinic");
  if (!access.ok) return { error: access.error };
  const clinicId = access.clinicId;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("seed_demo_patients_for_clinic", {
    p_clinic_id: clinicId,
  });

  if (error) {
    const msg = error.message ?? "";
    if (
      msg.includes("seed_demo_patients_for_clinic") ||
      msg.includes("function") ||
      error.code === "42883"
    ) {
      return {
        error:
          "Falta la función en Supabase. Ejecutá las migraciones 017 y 019 en el SQL Editor.",
      };
    }
    if (msg.includes("FORBIDDEN")) {
      return { error: "No tenés permiso para cargar datos demo en esta clínica." };
    }
    return { error: msg || "No se pudieron cargar los datos demo." };
  }

  const result = (data ?? {}) as {
    patients_upserted?: number;
    clinical_records?: number;
    appointments?: number;
  };

  revalidatePath("/pacientes");
  revalidatePath("/historias");
  revalidatePath("/agenda");
  revalidatePath("/dashboard");

  const parts = [
    `${result.patients_upserted ?? 12} pacientes`,
    result.appointments ? `${result.appointments} turnos` : null,
    result.clinical_records ? `${result.clinical_records} consultas` : null,
  ].filter(Boolean);

  return {
    success: true,
    message: `Datos demo cargados: ${parts.join(", ")}.`,
  };
}
