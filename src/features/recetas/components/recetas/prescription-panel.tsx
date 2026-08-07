"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { HistoriaPrescriptionSummary } from "@/features/historias/types/historia-clinical-summaries";
import { issuePrescription, voidPrescription } from "@/features/recetas/actions/prescriptions";
import { PrescriptionForm } from "@/features/recetas/components/recetas/prescription-form";
import { PrescriptionList } from "@/features/recetas/components/recetas/prescription-list";
import { SharePrescriptionButtons } from "@/features/recetas/components/recetas/share-prescription-buttons";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Professional {
  id: string;
  license_number?: string | null;
  display_name?: string | null;
  profiles?: { full_name: string } | null;
  specialties?: { name: string } | { name: string }[] | null;
}

interface Props {
  prescriptions: HistoriaPrescriptionSummary[];
  patient: {
    id: string;
    first_name: string;
    last_name: string;
    document_number: string;
    birth_date?: string | null;
    insurance_provider?: string | null;
    insurance_number?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  clinicalRecordId: string;
  diagnosis?: string | null;
  professionals: Professional[];
  clinic: { name: string; address?: string | null; phone?: string | null };
  canIssue: boolean;
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

      <PrescriptionList
        prescriptions={prescriptions}
        patient={patient}
        clinic={clinic}
        professionals={professionals}
        canIssue={canIssue}
        actingId={acting}
        onIssue={handleIssue}
        onVoid={handleVoid}
        shareSlot={(rx) =>
          rx.status === "issued" ? (
            <SharePrescriptionButtons prescription={rx} patient={patient} />
          ) : null
        }
      />
    </Card>
  );
}
