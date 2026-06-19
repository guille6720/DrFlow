import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { FileText, Plus } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PatientWhatsAppButton } from "@/components/ui/patient-whatsapp-button";
import { buildPatientContactMessage } from "@/lib/utils/patient-messages";
import { ImportClinicalPdfPanel } from "@/components/historias/import-clinical-pdf-panel";
import { hasPermission } from "@/lib/permissions/roles";

export default async function HistoriasPage() {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  const supabase = await createClient();
  const canImportClinicalPdf =
    hasPermission(role, "editClinicalRecords", isSuperadmin) ||
    hasPermission(role, "managePatients", isSuperadmin);

  // Supabase join types inferred loosely without generated Database types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let records: any[] = [];

  if (clinicId) {
    const { data } = await supabase
      .from("clinical_records")
      .select("id, diagnosis, chief_complaint, created_at, patients(first_name, last_name, phone), professionals(profiles(full_name))")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(50);
    records = data ?? [];
  }

  return (
    <>
      <Header
        title="Historia clínica digital"
        subtitle="Registro seguro de consultas médicas"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />

      <div className="space-y-4 p-4 sm:p-6">
        <ImportClinicalPdfPanel canImport={canImportClinicalPdf} />

        <div className="flex justify-end">
          <Link href="/historias/nueva">
            <Button>
              <Plus className="h-4 w-4" />
              Nueva consulta
            </Button>
          </Link>
        </div>

        {records.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Sin registros clínicos"
            description="Las consultas que registres aparecerán acá. Para probar rápido, cargá datos demo desde Configuración."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/configuracion#datos-demo">
                  <Button variant="secondary">Cargar datos demo</Button>
                </Link>
                <Link href="/historias/nueva">
                  <Button>
                    <Plus className="h-4 w-4" />
                    Registrar consulta
                  </Button>
                </Link>
              </div>
            }
          />
        ) : (
          <Card>
            <ul className="divide-y divide-slate-100">
              {records.map((r) => {
                const patientName = r.patients
                  ? `${r.patients.first_name} ${r.patients.last_name}`
                  : "Paciente";
                return (
                <li key={r.id} className="flex items-center justify-between gap-3 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">
                      {r.patients
                        ? `${r.patients.last_name}, ${r.patients.first_name}`
                        : "Paciente"}
                    </p>
                    <p className="text-sm text-slate-500">
                      {format(new Date(r.created_at), "PPp", { locale: es })}
                      {" · "}
                      {r.professionals?.profiles?.full_name ?? "Profesional"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {r.diagnosis ?? r.chief_complaint ?? "Sin diagnóstico"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <PatientWhatsAppButton
                      phone={r.patients?.phone}
                      message={buildPatientContactMessage(
                        patientName,
                        r.professionals?.profiles?.full_name ?? undefined
                      )}
                      size="icon"
                    />
                    <Link href={`/historias/${r.id}`} className="text-sm text-blue-700 hover:underline">
                      Ver detalle
                    </Link>
                  </div>
                </li>
              );
              })}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
