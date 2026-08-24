"use server";

import { revalidatePath } from "next/cache";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { getPatientCreateHeadroom } from "@/core/entitlements/limits.server";
import { shouldAllowBulkPatientCreate } from "@/core/entitlements/quota-display";
import { resolvePostgresUserMessage } from "@/core/errors/postgres-error";
import { recordAudit } from "@/core/security/audit-service";
import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";
import { createClient } from "@/core/supabase/server";

export type DemoSeedResult = {
  success?: boolean;
  error?: string;
  message?: string;
};

/** Same source clinic as `seed_demo_patients_for_clinic` (migration 019). */
const DEMO_SOURCE_CLINIC_ID = "a0000000-0000-4000-8000-000000000001";

async function countNewDemoPatients(clinicId: string): Promise<number | null> {
  if (!hasAdminClient()) return null;

  const admin = createAdminClient();
  const { data: demoPatients, error: demoError } = await admin
    .from("patients")
    .select("document_number")
    .eq("clinic_id", DEMO_SOURCE_CLINIC_ID);
  if (demoError) return null;

  const docs = (demoPatients ?? [])
    .map((row) => row.document_number)
    .filter((doc): doc is string => Boolean(doc));
  if (docs.length === 0) return 0;

  const { data: existing, error: existingError } = await admin
    .from("patients")
    .select("document_number")
    .eq("clinic_id", clinicId)
    .in("document_number", docs);
  if (existingError) return null;

  const already = new Set((existing ?? []).map((row) => row.document_number));
  return docs.filter((doc) => !already.has(doc)).length;
}

export async function seedDemoPatientsForActiveClinic(): Promise<DemoSeedResult> {
  const access = await requireClinicPermission("manageClinic");
  if (!access.ok) return { error: access.error };
  const clinicId = access.clinicId;

  const supabase = await createClient();
  const remaining = await getPatientCreateHeadroom({ clinicId, supabase });
  const adding = await countNewDemoPatients(clinicId);
  if (!shouldAllowBulkPatientCreate(remaining, adding)) {
    return {
      error: "El plan llegó al tope de pacientes. No se pueden cargar datos demo.",
    };
  }
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
