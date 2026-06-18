import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExportPrescriptionPdfButton } from "@/components/recetas/export-prescription-pdf";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/roles";
import { createClient } from "@/lib/supabase/server";
import { getProfessionalDisplayName } from "@/lib/utils/professional";
import { PRESCRIPTION_STATUS_LABELS } from "@/types/prescription";
import type { ElectronicPrescription } from "@/types/prescription";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus } from "lucide-react";

export default async function RecetasPage() {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin, clinic } = await getActiveClinic();

  if (!hasPermission(role, "issuePrescriptions", isSuperadmin)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  const [prescriptionsRes] = clinicId
    ? await Promise.all([
        supabase
          .from("prescription_drafts")
          .select(
            "*, patients(first_name, last_name, document_number, birth_date, insurance_provider), professionals(display_name, license_number, profiles(full_name), specialties(name))"
          )
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false })
          .limit(50),
      ])
    : [{ data: [] }];

  const prescriptions = (prescriptionsRes.data ?? []) as (ElectronicPrescription & {
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
  })[];

  return (
    <>
      <Header
        title="Recetas electrónicas"
        subtitle="Emisión local conforme Ley 25.649 — preparado para REFEPS"
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
          <Link href="/historias">
            <Button variant="outline" size="sm">
              Ver historias clínicas
            </Button>
          </Link>
        </div>

        <Card title="Recetas emitidas y borradores">
          {prescriptions.length === 0 ? (
            <p className="text-sm text-slate-500">
              Todavía no hay recetas. Creá una desde el detalle de una consulta en Historia clínica.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {prescriptions.map((rx) => {
                const patient = rx.patients;
                const pro = rx.professionals;
                return (
                  <li key={rx.id} className="flex flex-wrap items-start justify-between gap-4 py-4 first:pt-0">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">
                          {rx.prescription_number ?? rx.id.slice(0, 8)}
                        </p>
                        <Badge variant={rx.status === "issued" ? "success" : rx.status === "void" ? "danger" : "warning"}>
                          {PRESCRIPTION_STATUS_LABELS[rx.status]}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600">
                        {patient.last_name}, {patient.first_name} — DNI {patient.document_number}
                      </p>
                      <p className="text-xs text-slate-500">
                        {getProfessionalDisplayName(pro)} ·{" "}
                        {format(new Date(rx.issued_at ?? rx.created_at), "PPp", { locale: es })}
                        {rx.diagnosis_cie10 ? ` · ${rx.diagnosis_cie10}` : ""}
                      </p>
                      {rx.clinical_record_id && (
                        <Link
                          href={`/historias/${rx.clinical_record_id}`}
                          className="mt-1 inline-block text-xs text-blue-700 hover:underline"
                        >
                          Ver consulta
                        </Link>
                      )}
                    </div>
                    {rx.status === "issued" && clinic && (
                      <ExportPrescriptionPdfButton
                        prescription={rx}
                        patient={patient}
                        professional={{
                          full_name: pro.profiles?.full_name ?? pro.display_name ?? "Profesional",
                          license_number: pro.license_number,
                          specialty: pro.specialties?.name,
                        }}
                        clinic={{
                          name: clinic.name,
                          address: clinic.address,
                          phone: clinic.phone,
                        }}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
