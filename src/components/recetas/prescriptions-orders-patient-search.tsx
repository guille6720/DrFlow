"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  PatientSearchCombobox,
  type PatientSearchOption,
} from "@/components/pacientes/patient-search-combobox";

type Props = {
  patients: PatientSearchOption[];
  selectedPatientId?: string;
  onPatientChange: (patientId: string | null) => void;
};

export function PrescriptionsOrdersPatientSearch({
  patients,
  selectedPatientId,
  onPatientChange,
}: Props) {
  return (
    <Card title="Paciente">
      <PatientSearchCombobox
        patients={patients}
        label="Buscar paciente"
        placeholder="Nombre, apellido o DNI…"
        defaultPatientId={selectedPatientId}
        onPatientChange={(id) => onPatientChange(id || null)}
      />
      {!selectedPatientId && (
        <p className="mt-3 text-sm text-slate-500">
          Elegí un paciente para generar recetas u órdenes. También podés entrar desde{" "}
          <Link href="/pacientes" className="text-teal-700 hover:underline">
            Pacientes
          </Link>{" "}
          o la historia clínica.
        </p>
      )}
    </Card>
  );
}
