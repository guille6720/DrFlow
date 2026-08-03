/**
 * Multi-tenant scope helpers. DrFlow uses clinic_id as the tenant boundary.
 * Every server query on clinic-scoped data MUST filter by clinic_id from session.
 */

export const CLINIC_SCOPED_TABLES = [
  "patients",
  "patient_clinical_profiles",
  "patient_attachments",
  "clinical_records",
  "appointments",
  "prescription_drafts",
  "medical_orders",
  "professionals",
  "cash_charges",
  "patient_admin_documents",
] as const;

export type ClinicScopedTable = (typeof CLINIC_SCOPED_TABLES)[number];

export class TenantScopeError extends Error {
  constructor(message = "Recurso fuera del consultorio activo") {
    super(message);
    this.name = "TenantScopeError";
  }
}

/** Throws if resource clinic does not match active clinic (defense in depth vs RLS). */
export function assertSameClinic(
  activeClinicId: string,
  resourceClinicId: string | null | undefined,
  label = "recurso"
): void {
  if (!resourceClinicId || resourceClinicId !== activeClinicId) {
    throw new TenantScopeError(`${label} no pertenece al consultorio activo`);
  }
}

/** Returns false instead of throwing — useful in server actions. */
export function isSameClinic(
  activeClinicId: string,
  resourceClinicId: string | null | undefined
): boolean {
  return Boolean(resourceClinicId && resourceClinicId === activeClinicId);
}

/** Validates a loaded row belongs to the active clinic before mutating. */
export function requireResourceInClinic(
  clinicId: string,
  resourceClinicId: string | null | undefined
): { ok: true } | { ok: false; error: string } {
  if (!isSameClinic(clinicId, resourceClinicId)) {
    return { ok: false, error: "Recurso fuera del consultorio activo" };
  }
  return { ok: true };
}

/** Standard filter pair for Supabase queries by primary key within tenant. */
export function clinicScopedIdFilter(clinicId: string, id: string) {
  return { clinic_id: clinicId, id } as const;
}
