"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSettingsAccess } from "@/core/actions/clinic-guard";
import { createClient } from "@/core/supabase/server";
import { firstZodIssue, optionalEntityIdSchema, parseEntityId } from "@/core/validations/params";
import { createAvailabilityRuleSchema } from "@/core/validations/settings-schemas";

const TURNO_CONFIG_PATHS = ["/turnos/configuracion", "/turnos/agenda", "/turnos/nuevo", "/configuracion", "/agenda"];

function revalidateTurnosConfig() {
  for (const path of TURNO_CONFIG_PATHS) revalidatePath(path);
}

const updateRuleSchema = z.object({
  day_of_week: z.coerce.number().min(0).max(6),
  start_time: z.string(),
  end_time: z.string(),
  slot_duration: z.coerce.number().min(10).max(120),
  is_active: z.coerce.boolean().optional(),
  location_id: z.preprocess(
    (val) => (typeof val === "string" && val.trim() !== "" ? val.trim() : null),
    optionalEntityIdSchema
  ),
});

export async function deleteAvailabilityRule(id: string) {
  const { clinicId, error: permErr } = await requireSettingsAccess();
  if (permErr || !clinicId) return { error: permErr ?? "Sin permisos" };

  const idParsed = parseEntityId(id, "Horario");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("availability_rules")
    .delete()
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  revalidateTurnosConfig();
  return { success: true };
}

export async function setAvailabilityRuleActive(id: string, isActive: boolean) {
  const { clinicId, error: permErr } = await requireSettingsAccess();
  if (permErr || !clinicId) return { error: permErr ?? "Sin permisos" };

  const idParsed = parseEntityId(id, "Horario");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("availability_rules")
    .update({ is_active: isActive })
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  revalidateTurnosConfig();
  return { success: true };
}

export async function updateAvailabilityRule(id: string, input: unknown) {
  const { clinicId, error: permErr } = await requireSettingsAccess();
  if (permErr || !clinicId) return { error: permErr ?? "Sin permisos" };

  const idParsed = parseEntityId(id, "Horario");
  if (!idParsed.ok) return { error: idParsed.error };

  const parsed = updateRuleSchema.safeParse(input);
  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("availability_rules")
    .update({
      day_of_week: parsed.data.day_of_week,
      start_time: parsed.data.start_time,
      end_time: parsed.data.end_time,
      slot_duration: parsed.data.slot_duration,
      location_id: parsed.data.location_id ?? null,
      ...(parsed.data.is_active !== undefined ? { is_active: parsed.data.is_active } : {}),
    })
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  revalidateTurnosConfig();
  return { success: true };
}

export async function deleteScheduleBlock(id: string) {
  const { clinicId, error: permErr } = await requireSettingsAccess();
  if (permErr || !clinicId) return { error: permErr ?? "Sin permisos" };

  const idParsed = parseEntityId(id, "Bloqueo");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("schedule_blocks")
    .delete()
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  revalidateTurnosConfig();
  return { success: true };
}

export async function createTurnosAvailabilityRule(formData: FormData) {
  const { clinicId, error: permErr } = await requireSettingsAccess();
  if (permErr || !clinicId) return { error: permErr ?? "Sin permisos" };

  const parsed = createAvailabilityRuleSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("availability_rules").insert({
    clinic_id: clinicId,
    ...parsed.data,
  });

  if (error) return { error: error.message };

  revalidateTurnosConfig();
  return { success: true };
}
