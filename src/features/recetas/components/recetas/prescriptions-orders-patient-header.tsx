import { User } from "lucide-react";
import Link from "next/link";

import { patientClinicalHistoryPath } from "@/shared/utils/clinical-navigation";

import type { PrescriptionsOrdersPatient } from "@/features/recetas/components/recetas/prescriptions-orders-types";

import { Button } from "@/components/ui/button";

export function PrescriptionsOrdersPatientHeader({ patient }: { patient: PrescriptionsOrdersPatient }) {
  return (
    <div className="drflow-card-light flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-teal-50/40 p-4 shadow-sm">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 text-white shadow-md">
        <User className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold text-slate-900">
          {patient.last_name}, {patient.first_name}
        </p>
        <p className="text-sm text-slate-600">
          DNI {patient.document_number}
          {patient.insurance_provider ? ` · ${patient.insurance_provider}` : ""}
          {patient.insurance_number ? ` · Af. ${patient.insurance_number}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={patientClinicalHistoryPath(patient.id)}>
          <Button variant="outline" size="sm">
            Historia clínica
          </Button>
        </Link>
        <Link href={`/pacientes/${patient.id}`}>
          <Button variant="outline" size="sm">
            Ficha del paciente
          </Button>
        </Link>
      </div>
    </div>
  );
}
