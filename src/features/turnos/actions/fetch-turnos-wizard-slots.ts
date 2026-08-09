"use server";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import type { AppointmentAgendaRow } from "@/core/supabase/query-types";
import { createClient } from "@/core/supabase/server";

import { loadTurnosWizardSlots } from "@/features/turnos/server/load-turnos-wizard-slots";

export async function fetchTurnosWizardSlots(professionalId: string) {
  const access = await requireClinicPermission("manageAppointments");
  if (!access.ok) {
    return {
      error: access.error,
      slots: [] as Array<{ start_at: string; end_at: string; label: string }>,
      appointments: [] as AppointmentAgendaRow[],
      scheduleBlocks: [] as Array<{ start_at: string; end_at: string; reason: string | null }>,
    };
  }

  const supabase = await createClient();
  const { slots, appointments, scheduleBlocks } = await loadTurnosWizardSlots(
    supabase,
    access.clinicId,
    professionalId
  );
  return { slots, appointments, scheduleBlocks };
}
