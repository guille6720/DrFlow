type LocationScoped = { location_id: string | null };

export type AgendaFilterState = {
  professionalId?: string;
  specialtyId?: string;
  locationId?: string;
};

export function normalizeLocationId(locationId?: string | null): string | null {
  const trimmed = locationId?.trim();
  return trimmed ? trimmed : null;
}

/** Reglas con `location_id` null aplican a todas las sedes. */
export function filterAvailabilityRulesByLocation<T extends LocationScoped>(
  rules: T[],
  locationId?: string | null
): T[] {
  const id = normalizeLocationId(locationId);
  if (!id) return rules;
  return rules.filter((rule) => rule.location_id == null || rule.location_id === id);
}

export function filterAgendaAppointments<
  T extends LocationScoped & { professional_id: string; specialty_id: string | null },
>(appointments: T[], filters: AgendaFilterState): T[] {
  const locationId = normalizeLocationId(filters.locationId);
  return appointments.filter((appointment) => {
    if (filters.professionalId && appointment.professional_id !== filters.professionalId) {
      return false;
    }
    if (filters.specialtyId && appointment.specialty_id !== filters.specialtyId) {
      return false;
    }
    if (locationId && appointment.location_id !== locationId) {
      return false;
    }
    return true;
  });
}
