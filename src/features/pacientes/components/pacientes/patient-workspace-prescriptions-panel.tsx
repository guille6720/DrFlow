"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { HistoriaPrescriptionSummary } from "@/features/historias/types/historia-clinical-summaries";
import type { PatientEhrWorkspaceData } from "@/features/pacientes/server/load-patient-ehr-data";
import type { PatientWorkspaceProfessional } from "@/features/pacientes/server/load-patient-workspace-page";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";
import { markPrescriptionDispensed } from "@/features/recetas/actions/prescriptions";
import { PrescriptionList } from "@/features/recetas/components/recetas/prescription-list";
import { SharePrescriptionButtons } from "@/features/recetas/components/recetas/share-prescription-buttons";
import type { CoverageRuleOverridesMap } from "@/features/recetas/utils/coverage-rules-admin";
import { storePrescriptionReusePrefill } from "@/features/recetas/utils/prescription-reuse-prefill";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PrescriptionMedication } from "@/types/prescription";

type Props = {
  ehr: PatientEhrWorkspaceData;
  patientId: string;
  patient: {
    first_name: string;
    last_name: string;
    document_number: string;
    birth_date?: string | null;
    insurance_provider?: string | null;
    insurance_number?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  clinic: {
    name: string;
    address?: string | null;
    phone?: string | null;
    refepsEnabled?: boolean;
  };
  professionals: PatientWorkspaceProfessional[];
  canIssue: boolean;
  coverageRuleOverrides?: CoverageRuleOverridesMap | null;
};

export function PatientWorkspacePrescriptionsPanel({
  ehr,
  patientId,
  patient,
  clinic,
  professionals,
  canIssue,
  coverageRuleOverrides = null,
}: Props) {
  const router = useRouter();
  const [actingId, setActingId] = useState<string | null>(null);
  const prescriptions = ehr.prescriptionRecords as HistoriaPrescriptionSummary[];

  async function handleMarkDispensed(id: string) {
    setActingId(id);
    await markPrescriptionDispensed(id);
    setActingId(null);
    router.refresh();
  }

  function handleReuseMedications(rx: HistoriaPrescriptionSummary) {
    const medications = Array.isArray(rx.medications)
      ? (rx.medications as PrescriptionMedication[])
      : [];

    storePrescriptionReusePrefill(patientId, {
      medications,
      diagnosis_cie10: rx.diagnosis_cie10,
      diagnosis_text: rx.diagnosis_text,
      notes: rx.notes,
      patient_insurance: rx.patient_insurance,
      sourcePrescriptionId: rx.id,
    });

    router.push(
      buildPatientWorkspaceUrl(patientId, {
        tab: "recetas",
        action: "nueva",
      })
    );
  }

  return (
    <Card
      title="Recetas"
      action={
        canIssue ? (
          <Link href={buildPatientWorkspaceUrl(patientId, { tab: "recetas", action: "nueva" })}>
            <Button size="sm" type="button">
              <Plus className="h-4 w-4" />
              Nueva receta
            </Button>
          </Link>
        ) : null
      }
    >
      <PrescriptionList
        prescriptions={prescriptions}
        patient={patient}
        clinic={clinic}
        professionals={professionals}
        canIssue={canIssue}
        actingId={actingId}
        onMarkDispensed={canIssue ? handleMarkDispensed : undefined}
        onReuseMedications={canIssue ? handleReuseMedications : undefined}
        shareSlot={(rx) =>
          rx.status === "issued" ? (
            <SharePrescriptionButtons prescription={rx} patient={patient} />
          ) : null
        }
        coverageRuleOverrides={coverageRuleOverrides}
        refepsEnabled={clinic.refepsEnabled ?? false}
      />
    </Card>
  );
}
