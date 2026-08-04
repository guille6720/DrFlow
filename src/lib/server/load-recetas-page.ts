import type { SupabaseClient } from "@supabase/supabase-js";
import { parseHabitualMedicationText } from "@/lib/utils/parse-habitual-meds";
import type { PrescriptionMedication } from "@/types/prescription";
import type { ElectronicPrescription } from "@/types/prescription";
import type { MedicalOrder } from "@/types/medical-order";

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
  const [patientsRes, professionalsRes, recentRxRes] = clinicId
    ? await Promise.all([
        supabase
          .from("patients")
          .select("id, first_name, last_name, document_number")
          .eq("clinic_id", clinicId)
          .eq("is_active", true)
          .order("last_name")
          .limit(500),
        supabase
          .from("professionals")
          .select("*, profiles(full_name), specialties(name)")
          .eq("clinic_id", clinicId)
          .eq("is_active", true),
        supabase
          .from("prescription_drafts")
          .select(
            "*, patients(first_name, last_name, document_number, birth_date, insurance_provider), professionals(display_name, license_number, profiles(full_name), specialties(name))"
          )
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false })
          .limit(30),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const patients = patientsRes.data ?? [];
  const professionals = professionalsRes.data ?? [];
  const recentPrescriptions = (recentRxRes.data ?? []) as RecetasPageData["recentPrescriptions"];

  let selectedPatient: RecetasPageData["selectedPatient"] = null;
  let patientPrescriptions: RecetasPageData["patientPrescriptions"] = [];
  let patientOrders: RecetasPageData["patientOrders"] = [];
  let prefillDiagnosis = "";
  const prefillCie10 = "";
  let initialMedications: PrescriptionMedication[] | undefined;

  if (clinicId && patientId) {
    const [patientRes, rxRes, ordersRes, lastRecordRes, lastRxRes] = await Promise.all([
      supabase
        .from("patients")
        .select(
          "id, first_name, last_name, document_number, birth_date, insurance_provider, insurance_number, phone, email, regular_medication"
        )
        .eq("clinic_id", clinicId)
        .eq("id", patientId)
        .maybeSingle(),
      supabase
        .from("prescription_drafts")
        .select("*, professionals(display_name, license_number, profiles(full_name), specialties(name))")
        .eq("clinic_id", clinicId)
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("medical_orders")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("patient_id", patientId)
        .order("issued_at", { ascending: false })
        .limit(20),
      supabase
        .from("clinical_records")
        .select("diagnosis, evolution")
        .eq("clinic_id", clinicId)
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("prescription_drafts")
        .select("medications")
        .eq("clinic_id", clinicId)
        .eq("patient_id", patientId)
        .neq("status", "void")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    selectedPatient = patientRes.data;
    patientPrescriptions = (rxRes.data ?? []) as RecetasPageData["patientPrescriptions"];
    patientOrders = (ordersRes.data ?? []) as RecetasPageData["patientOrders"];

    const lastRecord = lastRecordRes.data;
    if (lastRecord?.diagnosis) prefillDiagnosis = lastRecord.diagnosis;
    else if (lastRecord?.evolution) {
      prefillDiagnosis = lastRecord.evolution.slice(0, 200);
    }

    const lastMeds = (lastRxRes.data?.medications as PrescriptionMedication[] | null) ?? null;
    if (lastMeds && lastMeds.length > 0) {
      initialMedications = lastMeds;
    } else if (selectedPatient?.regular_medication) {
      const parsed = parseHabitualMedicationText(selectedPatient.regular_medication);
      if (parsed.length > 0) initialMedications = parsed;
    }
  }

  return {
    patients,
    professionals,
    recentPrescriptions,
    selectedPatient,
    patientPrescriptions,
    patientOrders,
    prefillDiagnosis,
    prefillCie10,
    initialMedications,
    defaultProfessionalId: professionalParam?.trim() || professionals[0]?.id,
    defaultTab: tipo === "orden" ? "orden" : "receta",
    clinic: {
      name: clinicName,
      address: clinicAddress,
      phone: clinicPhone,
    },
  };
}
