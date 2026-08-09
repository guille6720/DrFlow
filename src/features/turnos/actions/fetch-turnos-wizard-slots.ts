"use server";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { createClient } from "@/core/supabase/server";

import { loadTurnosWizardSlots } from "@/features/turnos/server/load-turnos-wizard-slots";

export async function fetchTurnosWizardSlots(professionalId: string) {
  const access = await requireClinicPermission("manageAppointments");
  if (!access.ok) return { error: access.error, slots: [] as Array<{ start_at: string; end_at: string; label: string }> };

  const supabase = await createClient();
  const { slots } = await loadTurnosWizardSlots(supabase, access.clinicId, professionalId);
  return { slots };
}
