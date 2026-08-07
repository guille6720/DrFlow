import { Plus } from "lucide-react";
import Link from "next/link";

import type { HistoriaPrescriptionSummary } from "@/features/historias/types/historia-clinical-summaries";
import type { PatientEhrWorkspaceData } from "@/features/pacientes/server/load-patient-ehr-data";
import type { PatientWorkspaceProfessional } from "@/features/pacientes/server/load-patient-workspace-page";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";
import { PrescriptionList } from "@/features/recetas/components/recetas/prescription-list";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
  };
  clinic: {
    name: string;
    address?: string | null;
    phone?: string | null;
  };
  professionals: PatientWorkspaceProfessional[];
  canIssue: boolean;
};

export function PatientWorkspacePrescriptionsPanel({
  ehr,
  patientId,
  patient,
  clinic,
  professionals,
  canIssue,
}: Props) {
  const prescriptions = ehr.prescriptionRecords as HistoriaPrescriptionSummary[];

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
      />
    </Card>
  );
}
