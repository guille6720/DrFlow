"use server";

import { getActiveClinic, getActiveClinicId, getSession } from "@/core/auth/session.server";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

import type {
  AvailabilityRuleRow,
  ProfessionalIntakeDetail,
} from "@/features/profesionales/components/profesionales/professional-intake-types";
import { loadProfessionalIntakeDetail } from "@/features/profesionales/server/load-professional-intake-page-data";

export type ProfessionalIntakeDetailResult = {
  professional?: ProfessionalIntakeDetail | null;
  rules?: AvailabilityRuleRow[];
  error?: string;
};

/** Loads a single professional profile on sidebar selection without a full page reload. */
export async function loadProfessionalIntakeDetailPanel(
  professionalId: string
): Promise<ProfessionalIntakeDetailResult> {
  const user = await getSession();
  if (!user) return { error: "Sin sesión" };

  const clinicId = await getActiveClinicId();
  if (!clinicId) return { error: "Sin clínica activa" };

  const { role, isSuperadmin } = await getActiveClinic();
  if (!hasPermission(role, "manageStaff", isSuperadmin)) {
    return { error: "Sin permisos" };
  }

  const parsedId = parseEntityId(professionalId, "Profesional");
  if (!parsedId.ok) return { error: parsedId.error };

  const supabase = await createClient();
  const result = await loadProfessionalIntakeDetail(supabase, clinicId, parsedId.data);
  return { professional: result.professional, rules: result.rules };
}
