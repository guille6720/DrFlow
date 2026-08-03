import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { PrescriptionsOrdersHub } from "@/features/recetas";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/roles";
import { createClient } from "@/lib/supabase/server";
import { parseHabitualMedicationText } from "@/lib/utils/parse-habitual-meds";
import type { PrescriptionMedication } from "@/types/prescription";
import type { ElectronicPrescription } from "@/types/prescription";
import type { MedicalOrder } from "@/types/medical-order";
import { Plus } from "lucide-react";

export default async function RecetasPage({
  searchParams,
}: {
  searchParams: Promise<{
    patient?: string;
    tipo?: string;
    consulta?: string;
    appointment?: string;
    professional?: string;
  }>;
}) {
  const { patient: patientId, tipo, professional: professionalParam } = await searchParams;
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin, clinic } = await getActiveClinic();

  if (!hasPermission(role, "issuePrescriptions", isSuperadmin)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();

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
  const recentPrescriptions = (recentRxRes.data ?? []) as Array<
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

  let selectedPatient = null;
  let patientPrescriptions: (ElectronicPrescription & {
    professionals?: {
      display_name: string | null;
      license_number: string | null;
      profiles: { full_name: string } | null;
      specialties: { name: string } | null;
    } | null;
  })[] = [];
  let patientOrders: (MedicalOrder & { order_type?: string })[] = [];
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
    patientPrescriptions = (rxRes.data ?? []) as typeof patientPrescriptions;
    patientOrders = (ordersRes.data ?? []) as typeof patientOrders;

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

  const defaultTab = tipo === "orden" ? "orden" : "receta";

  return (
    <>
      <Header
        title="Recetas y órdenes"
        subtitle="Generá recetas electrónicas y órdenes médicas por paciente"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap gap-2">
          <Link href="/historias/nueva">
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4" />
              Nueva consulta
            </Button>
          </Link>
          <Link href="/pacientes">
            <Button variant="outline" size="sm">
              Ver pacientes
            </Button>
          </Link>
        </div>

        <Suspense fallback={<p className="text-sm text-slate-500">Cargando…</p>}>
          <PrescriptionsOrdersHub
            patients={patients}
            professionals={professionals}
            clinic={{
              name: clinic?.name ?? "Consultorio",
              address: clinic?.address,
              phone: clinic?.phone,
            }}
            selectedPatient={selectedPatient}
            patientPrescriptions={patientPrescriptions}
            patientOrders={patientOrders}
            recentPrescriptions={recentPrescriptions}
            prefillDiagnosis={prefillDiagnosis}
            prefillCie10={prefillCie10}
            initialMedications={initialMedications}
            defaultProfessionalId={professionalParam?.trim() || professionals[0]?.id}
            defaultTab={defaultTab}
          />
        </Suspense>
      </div>
    </>
  );
}
