"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PrescriptionForm } from "@/components/recetas/prescription-form";
import { ExportPrescriptionPdfButton } from "@/components/recetas/export-prescription-pdf";
import { SharePrescriptionButtons } from "@/components/recetas/share-prescription-buttons";
import { issuePrescription, voidPrescription } from "@/lib/actions/prescriptions";
import { PRESCRIPTION_STATUS_LABELS } from "@/types/prescription";
import type { ElectronicPrescription } from "@/types/prescription";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus } from "lucide-react";

interface Professional {
  id: string;
  license_number?: string | null;
  display_name?: string | null;
  profiles?: { full_name: string } | null;
  specialties?: { name: string } | { name: string }[] | null;
}

interface Props {
  prescriptions: ElectronicPrescription[];
  patient: {
    id: string;
    first_name: string;
    last_name: string;
    document_number: string;
    birth_date?: string | null;
    insurance_provider?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  clinicalRecordId: string;
  diagnosis?: string | null;
  professionals: Professional[];
  clinic: { name: string; address?: string | null; phone?: string | null };
  canIssue: boolean;
}

function statusVariant(status: string): "default" | "success" | "warning" | "danger" {
  if (status === "issued") return "success";
  if (status === "void") return "danger";
  return "warning";
}

export function PrescriptionPanel({
  prescriptions,
  patient,
  clinicalRecordId,
  diagnosis,
  professionals,
  clinic,
  canIssue,
}: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  async function handleIssue(id: string) {
    setActing(id);
    await issuePrescription(id);
    setActing(null);
    router.refresh();
  }

  async function handleVoid(id: string) {
    setActing(id);
    await voidPrescription(id);
    setActing(null);
    router.refresh();
  }

  const defaultPro = professionals[0];

  return (
    <Card title="Receta electrónica (Argentina)">
      {canIssue && (
        <div className="mb-4">
          <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4" />
            {showForm ? "Ocultar formulario" : "Nueva receta"}
          </Button>
        </div>
      )}

      {showForm && canIssue && (
        <div className="mb-6 border-b border-slate-100 pb-6">
          <PrescriptionForm
            patientId={patient.id}
            patientInsurance={patient.insurance_provider}
            clinicalRecordId={clinicalRecordId}
            diagnosisDefault={diagnosis ?? ""}
            professionals={professionals}
            defaultProfessionalId={defaultPro?.id}
            onSuccess={() => setShowForm(false)}
          />
        </div>
      )}

      {prescriptions.length === 0 ? (
        <p className="text-sm text-slate-500">No hay recetas asociadas a esta consulta.</p>
      ) : (
        <ul className="space-y-3">
          {prescriptions.map((rx) => {
            const pro = professionals.find((p) => p.id === rx.professional_id);
            const spec = Array.isArray(pro?.specialties) ? pro?.specialties[0] : pro?.specialties;
            return (
              <li key={rx.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">
                      {rx.prescription_number ?? rx.id.slice(0, 8)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {format(new Date(rx.issued_at ?? rx.created_at), "PPp", { locale: es })}
                      {rx.diagnosis_cie10 ? ` · CIE-10 ${rx.diagnosis_cie10}` : ""}
                    </p>
                  </div>
                  <Badge variant={statusVariant(rx.status)}>
                    {PRESCRIPTION_STATUS_LABELS[rx.status]}
                  </Badge>
                </div>

                <p className="mt-2 text-sm text-slate-700">{rx.diagnosis_text}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {(rx.medications as { generic_name: string }[]).length} medicamento(s)
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {rx.status === "issued" && (
                    <>
                      <ExportPrescriptionPdfButton
                        prescription={rx}
                        patient={patient}
                        professional={{
                          full_name: pro?.profiles?.full_name ?? pro?.display_name ?? "Profesional",
                          license_number: pro?.license_number,
                          specialty: spec?.name,
                        }}
                        clinic={clinic}
                      />
                      <SharePrescriptionButtons prescription={rx} patient={patient} />
                    </>
                  )}
                  {canIssue && rx.status === "draft" && (
                    <Button size="sm" loading={acting === rx.id} onClick={() => handleIssue(rx.id)}>
                      Emitir
                    </Button>
                  )}
                  {canIssue && rx.status !== "void" && (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={acting === rx.id}
                      onClick={() => handleVoid(rx.id)}
                    >
                      Anular
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
