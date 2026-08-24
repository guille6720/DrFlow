"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Header } from "@/core/components/layout/header";

import { updatePatient } from "@/features/pacientes/actions/patients";
import { DeletePatientButton } from "@/features/pacientes/components/pacientes/delete-patient-button";
import { PatientAdminFormFields } from "@/features/pacientes/components/pacientes/patient-admin-form-fields";
import { PatientClinicalProfileFields } from "@/features/pacientes/components/pacientes/patient-clinical-profile-fields";
import { PatientFormFields } from "@/features/pacientes/components/pacientes/patient-form-fields";
import {
  chartExtrasFromFormData,
  mergeNotesWithChartExtras,
} from "@/features/pacientes/utils/patient-chart-notes";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Clinic, Patient, UserRole } from "@/types/database";

interface Props {
  patient: Patient;
  clinics: { clinic_id: string; clinic?: Clinic }[];
  clinicId: string | null;
  role: UserRole | null;
  userName?: string;
  defaultInsurance?: string | null;
  acceptedCoverages?: string[] | null;
}

export function EditPatientForm({
  patient,
  clinics,
  clinicId,
  role,
  userName,
  defaultInsurance,
  acceptedCoverages,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const adminOnly = role === "secretary";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (!adminOnly) {
      const extras = chartExtrasFromFormData(fd);
      const freeNotes = fd.get("notes");
      const mergedNotes = mergeNotesWithChartExtras(
        typeof freeNotes === "string" ? freeNotes : "",
        extras
      );
      fd.set("notes", mergedNotes ?? "");
    }
    const result = await updatePatient(patient.id, fd);
    setLoading(false);
    if (result.error) setError(result.error);
    else router.push(`/pacientes/${patient.id}`);
  }

  return (
    <>
      <Header
        title="Editar paciente"
        subtitle={`${patient.last_name}, ${patient.first_name}`}
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={userName}
      />
      <div className="p-4 sm:p-6">
        <Link href={`/pacientes/${patient.id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-blue-700 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Volver al paciente
        </Link>
        <Card title="Datos del paciente">
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            {adminOnly ? (
              <PatientAdminFormFields
                patient={patient}
                defaultInsurance={defaultInsurance}
                acceptedCoverages={acceptedCoverages}
              />
            ) : (
              <>
                <PatientFormFields
                  patient={patient}
                  defaultInsurance={defaultInsurance}
                  acceptedCoverages={acceptedCoverages}
                />
                <PatientClinicalProfileFields patient={patient} />
              </>
            )}
            {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" loading={loading} pendingLabel="Guardando...">
                Guardar cambios
              </Button>
              <Link href={`/pacientes/${patient.id}`}>
                <Button type="button" variant="outline">Cancelar</Button>
              </Link>
              <DeletePatientButton
                patientId={patient.id}
                patientName={`${patient.last_name}, ${patient.first_name}`}
              />
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
