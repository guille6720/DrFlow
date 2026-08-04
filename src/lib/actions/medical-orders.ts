"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMedicalOrderAccess } from "@/lib/services/clinical-access.service";
import {
  createMedicalOrderRecord,
  parseMedicalOrderForm,
  voidMedicalOrderRecord,
} from "@/lib/services/medical-orders.service";

export async function createMedicalOrder(formData: FormData) {
  const access = await requireMedicalOrderAccess();
  if (!access.ok) return { error: access.error };
  const { userId, clinicId } = access.data;

  const input = parseMedicalOrderForm(formData);
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

  const supabase = await createClient();
  const result = await voidMedicalOrderRecord(supabase, id, access.data.clinicId);
  if (!result.ok) return { error: result.error };

  revalidatePath("/historias");
  revalidatePath("/recetas");
  return { success: true };
}
