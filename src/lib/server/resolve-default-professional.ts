import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";

import { pickDefaultProfessionalId } from "@/lib/utils/default-professional";

/** Active clinic_admin member's professional row (prescriber default for the clinic). */
export const resolveClinicAdminProfessionalId = cache(
  async (supabase: SupabaseClient, clinicId: string): Promise<string | undefined> => {
    const { data: adminMember } = await supabase
      .from("clinic_members")
      .select("professional_id, user_id")
      .eq("clinic_id", clinicId)
      .eq("role", "clinic_admin")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (adminMember?.professional_id) {
      return adminMember.professional_id;
    }

    if (adminMember?.user_id) {
      const { data: pro } = await supabase
        .from("professionals")
        .select("id")
        .eq("clinic_id", clinicId)
        .eq("user_id", adminMember.user_id)
        .eq("is_active", true)
        .maybeSingle();
      if (pro?.id) return pro.id;
    }

    return undefined;
  }
);

export async function resolveDefaultProfessionalId(
  supabase: SupabaseClient,
  clinicId: string,
  professionals: Array<{ id: string }>,
  override?: string | null
): Promise<string | undefined> {
  const adminId = await resolveClinicAdminProfessionalId(supabase, clinicId);
  return pickDefaultProfessionalId(adminId, professionals, override);
}
