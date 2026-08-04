"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/core/supabase/server";
import { requireMedicalOrderAccess } from "@/core/services/clinical-access.service";
import {
  createMedicalOrderRecord,
  parseMedicalOrderForm,
  validateMedicalOrderInput,
  voidMedicalOrderRecord,
} from "@/features/recetas/services/medical-orders.service";
import { parseEntityId } from "@/core/validations/params";

export async function createMedicalOrder(formData: FormData) {
  const access = await requireMedicalOrderAccess();
  if (!access.ok) return { error: access.error };
  const { userId, clinicId } = access.data;

  const input = parseMedicalOrderForm(formData);
  const validationError = validateMedicalOrderInput(input);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const result = await createMedicalOrderRecord(supabase, {
    ...input,
    clinicId,
    userId,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/historias");
  revalidatePath("/recetas");
  return { data: result.data };
}

export async function voidMedicalOrder(id: string) {
  const access = await requireMedicalOrderAccess();
  if (!access.ok) return { error: access.error };

  const idParsed = parseEntityId(id, "Orden");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const result = await voidMedicalOrderRecord(supabase, idParsed.data, access.data.clinicId);
  if (!result.ok) return { error: result.error };

  revalidatePath("/historias");
  revalidatePath("/recetas");
  return { success: true };
}
