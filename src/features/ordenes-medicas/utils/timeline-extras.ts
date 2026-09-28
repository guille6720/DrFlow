import type { SupabaseClient } from "@supabase/supabase-js";

import type { MedicalOrder } from "@/types/medical-order";

type ExtrasRow = {
  id: string;
  order_number: string | null;
  order_category: string | null;
  professionals?: {
    display_name: string | null;
    profiles?: { full_name: string | null } | { full_name: string | null }[] | null;
  } | null;
};

/**
 * Adds v2 fields (number, category, professional) to orders shown in the clinical timeline.
 * Leaves orders untouched when the DB has no v2 columns yet.
 */
export async function enrichOrdersForTimeline<T extends MedicalOrder>(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string,
  orders: T[]
): Promise<T[]> {
  if (orders.length === 0) return orders;
  try {
    const { data, error } = await supabase
      .from("medical_orders")
      .select("id, order_number, order_category, professionals(display_name, profiles(full_name))")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .in(
        "id",
        orders.map((o) => o.id)
      );
    if (error || !data) return orders;
    const byId = new Map((data as unknown as ExtrasRow[]).map((r) => [r.id, r]));
    return orders.map((o) => {
      const extra = byId.get(o.id);
      if (!extra) return o;
      const profile = Array.isArray(extra.professionals?.profiles)
        ? extra.professionals?.profiles[0]
        : extra.professionals?.profiles;
      return {
        ...o,
        order_number: extra.order_number,
        order_category: extra.order_category,
        professional_name: extra.professionals?.display_name?.trim() || profile?.full_name?.trim() || null,
      };
    });
  } catch {
    return orders;
  }
}
