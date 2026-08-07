/** Shared PAMI planilla entity shapes — server loaders and client hooks. */
export type PamiPlanillaPatient = {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
  insurance_number: string | null;
  phone: string | null;
  address: string | null;
};

import type { NestedRow } from "@/core/supabase/query-types";

export type PamiPlanillaProfessional = {
  id: string;
  license_number?: string | null;
  display_name?: string | null;
  profiles?: NestedRow<{ full_name: string }>;
};
