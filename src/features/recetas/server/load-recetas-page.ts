import type { SupabaseClient } from "@supabase/supabase-js";

import { PRESCRIPTION_RECENT_LIST_COLUMNS } from "@/core/supabase/select-columns";

import { getCachedClinicProfessionalsFull } from "@/lib/server/cached-clinic-queries";
import { resolveDefaultProfessionalId } from "@/lib/server/resolve-default-professional";
import type { MedicalOrder } from "@/types/medical-order";
import type { ElectronicPrescription, PrescriptionMedication } from "@/types/prescription";

export type RecetasPageData = {
  patients: Array<{ id: string; first_name: string; last_name: string; document_number: string }>;
  professionals: Array<{ id: string } & Record<string, unknown>>;
  recentPrescriptions: Array<
    ElectronicPrescription & {
      patients: {
        first_name: string;
        last_name: string;
        document_number: string;
        birth_date: string | null;
        insurance_provider: string | null;
      };
      professionals: {
        display_name: string | null;
        license_number: string | null;
        profiles: { full_name: string } | null;
        specialties: { name: string } | null;
      };
    }
  >;
  selectedPatient: {
    id: string;
    first_name: string;
    last_name: string;
    document_number: string;
    birth_date: string | null;
    insurance_provider: string | null;
    insurance_number: string | null;
    phone: string | null;
    email: string | null;
    regular_medication: string | null;
  } | null;
  patientPrescriptions: (ElectronicPrescription & {
    professionals?: {
      display_name: string | null;
      license_number: string | null;
      profiles: { full_name: string } | null;
      specialties: { name: string } | null;
    } | null;
  })[];
  patientOrders: (MedicalOrder & { order_type?: string })[];
  prefillDiagnosis: string;
  prefillCie10: string;
  initialMedications: PrescriptionMedication[] | undefined;
  defaultProfessionalId: string | undefined;
  defaultTab: "receta" | "orden";
  clinic: { name: string; address?: string | null; phone?: string | null };
};

export async function loadRecetasPageData(
  supabase: SupabaseClient,
  clinicId: string | null,
  patientId: string | undefined,
  tipo: string | undefined,
  professionalParam: string | undefined,
  clinicName: string,
  clinicAddress?: string | null,
  clinicPhone?: string | null
): Promise<RecetasPageData> {
  const [professionals, recentRxRes] = clinicId
    ? await Promise.all([
        getCachedClinicProfessionalsFull(clinicId),
        supabase
          .from("prescription_drafts")
          .select(
            `${PRESCRIPTION_RECENT_LIST_COLUMNS}, patients(first_name, last_name, document_number, birth_date, insurance_provider), professionals(display_name, license_number, profiles(full_name), specialties(name))`
          )
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false })
          .limit(30),
      ])
    : [[], { data: [] }];

  const recentPrescriptions = (recentRxRes.data ?? []) as unknown as RecetasPageData["recentPrescriptions"];
  const defaultProfessionalId = clinicId
    ? await resolveDefaultProfessionalId(supabase, clinicId, professionals, professionalParam)
    : undefined;

  return {
    patients: [],
    professionals,
    recentPrescriptions,
    selectedPatient: null,
    patientPrescriptions: [],
    patientOrders: [],
    prefillDiagnosis: "",
    prefillCie10: "",
    initialMedications: undefined,
    defaultProfessionalId,
    defaultTab: tipo === "orden" ? "orden" : "receta",
    clinic: {
      name: clinicName,
      address: clinicAddress,
      phone: clinicPhone,
    },
  };
}
