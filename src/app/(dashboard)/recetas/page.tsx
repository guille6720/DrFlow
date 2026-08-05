import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/core/auth/session";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";
import { PrescriptionsOrdersHub } from "@/features/recetas";
import { loadRecetasPageData } from "@/features/recetas/server/load-recetas-page";

import { Button } from "@/components/ui/button";

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
  const { patient: patientId, tipo, professional: professionalParam, consulta } = await searchParams;

  if (patientId) {
    redirect(
      buildPatientWorkspaceUrl(patientId, {
        tab: tipo === "orden" ? "ordenes" : "recetas",
        action: "nueva",
        professional: professionalParam,
        consulta,
      })
    );
  }

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
            clinic={pageData.clinic}
            selectedPatient={pageData.selectedPatient}
            recentPrescriptions={pageData.recentPrescriptions}
          />
        </Suspense>
      </div>
    </>
  );
}
