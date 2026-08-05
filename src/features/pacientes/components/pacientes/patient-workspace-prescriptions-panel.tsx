import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus } from "lucide-react";
import Link from "next/link";

import type { PatientEhrWorkspaceData } from "@/features/pacientes/server/load-patient-ehr-data";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Props = {
  ehr: PatientEhrWorkspaceData;
  patientId: string;
  canIssue: boolean;
};

export function PatientWorkspacePrescriptionsPanel({ ehr, patientId, canIssue }: Props) {
  const issued = ehr.prescriptions;

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
      {issued.length === 0 ? (
        <p className="text-sm text-slate-500">Sin recetas emitidas para este paciente.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {issued.map((rx) => (
            <li key={rx.id} className="py-3">
              <p className="font-medium">{rx.label}</p>
              <p className="text-xs text-slate-500">
                {format(new Date(rx.created_at), "PPp", { locale: es })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
