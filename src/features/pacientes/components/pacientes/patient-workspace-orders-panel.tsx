import { Plus } from "lucide-react";
import Link from "next/link";

import type { PatientEhrWorkspaceData } from "@/features/pacientes/server/load-patient-ehr-data";
import type { PatientWorkspaceProfessional } from "@/features/pacientes/server/load-patient-workspace-page";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";
import { MedicalOrderList } from "@/features/recetas/components/recetas/medical-order-list";

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

export function PatientWorkspaceOrdersPanel({
  ehr,
  patientId,
  patient,
  clinic,
  professionals,
  canIssue,
}: Props) {
  return (
    <Card
      title="Órdenes médicas"
      action={
        canIssue ? (
          <Link href={buildPatientWorkspaceUrl(patientId, { tab: "ordenes", action: "nueva" })}>
            <Button size="sm" type="button">
              <Plus className="h-4 w-4" />
              Nueva orden
            </Button>
          </Link>
        ) : null
      }
    >
      {ehr.orders.length === 0 ? (
        <p className="text-sm text-slate-500">Sin órdenes emitidas.</p>
      ) : (
        <MedicalOrderList
          orders={ehr.orders}
          patient={patient}
          clinic={clinic}
          professionals={professionals}
        />
      )}
    </Card>
  );
}
