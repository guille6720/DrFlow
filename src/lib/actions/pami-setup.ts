"use server";

import { revalidatePath } from "next/cache";
import { getActiveClinicId } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function configurePamiCabecera(): Promise<{
  success?: boolean;
  error?: string;
  message?: string;
}> {
  const clinicId = await getActiveClinicId();
  if (!clinicId) return { error: "No hay clínica activa." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("seed_pami_cabecera_for_clinic", {
    p_clinic_id: clinicId,
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("seed_pami_cabecera") || msg.includes("function")) {
      return {
        error: "Ejecutá la migración 020 en Supabase SQL Editor (020_pami_cabecera.sql).",
      };
    }
    return { error: msg || "No se pudo configurar el perfil PAMI." };
  }

  const result = (data ?? {}) as { templates_added?: number; reasons_added?: number };

  revalidatePath("/configuracion");
  revalidatePath("/dashboard");
  revalidatePath("/historias/nueva");
  revalidatePath("/guia-pami");

  return {
    success: true,
    message: `Consultorio PAMI listo: ${result.templates_added ?? 5} plantillas clínicas, turnos de 20 min, cobertura PAMI por defecto.`,
  };
}
