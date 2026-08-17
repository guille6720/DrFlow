"use server";

import { revalidatePath } from "next/cache";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { resolvePostgresUserMessage } from "@/core/errors/postgres-error";
import { recordAudit } from "@/core/security/audit-service";
import { createClient } from "@/core/supabase/server";

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
    return {
      error: resolvePostgresUserMessage(error, {
        rpcMessages: {
          FORBIDDEN: "No tenés permiso para cargar datos demo en esta clínica.",
        },
        fallback: "No se pudieron cargar los datos demo.",
      }),
    };
  }

  const result = (data ?? {}) as {
    patients_upserted?: number;
    clinical_records?: number;
    appointments?: number;
  };

  await recordAudit({
    clinicId,
    module: "settings",
    entityType: "clinic",
    entityId: clinicId,
    action: "create",
    what: "Cargó datos demo en la clínica",
    metadata: result,
  });

  revalidatePath("/pacientes");
  revalidatePath("/turnos/agenda");
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
