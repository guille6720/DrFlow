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
import { loadRecetasPageData } from "@/lib/server/load-recetas-page";
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
  const pageData = await loadRecetasPageData(
    supabase,
    clinicId,
    patientId,
    tipo,
    professionalParam,
    clinic?.name ?? "Consultorio",
    clinic?.address,
    clinic?.phone
  );

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
            patients={pageData.patients}
            professionals={pageData.professionals}
            clinic={pageData.clinic}
            selectedPatient={pageData.selectedPatient}
            patientPrescriptions={pageData.patientPrescriptions}
            patientOrders={pageData.patientOrders}
            recentPrescriptions={pageData.recentPrescriptions}
            prefillDiagnosis={pageData.prefillDiagnosis}
            prefillCie10={pageData.prefillCie10}
            initialMedications={pageData.initialMedications}
            defaultProfessionalId={pageData.defaultProfessionalId}
            defaultTab={pageData.defaultTab}
          />
        </Suspense>
      </div>
    </>
  );
}
