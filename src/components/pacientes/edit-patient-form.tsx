"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PatientFormFields } from "@/components/pacientes/patient-form-fields";
import { updatePatient } from "@/lib/actions/clinic";
import { deactivatePatient } from "@/lib/actions/settings";
import type { Clinic, Patient, UserRole } from "@/types/database";
import { ArrowLeft } from "lucide-react";

interface Props {
  patient: Patient;
  clinics: { clinic_id: string; clinic?: Clinic }[];
  clinicId: string | null;
  role: UserRole | null;
  userName?: string;
}

export function EditPatientForm({ patient, clinics, clinicId, role, userName }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await updatePatient(patient.id, new FormData(e.currentTarget));
    setLoading(false);
    if (result.error) setError(result.error);
    else router.push(`/pacientes/${patient.id}`);
  }

  async function handleDeactivate() {
    if (!confirm("¿Desactivar este paciente? No se eliminará del historial.")) return;
    const result = await deactivatePatient(patient.id);
    if (result.error) setError(result.error);
    else router.push("/pacientes");
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
          <ArrowLeft className="h-4 w-4" /> Volver a la ficha
        </Link>
        <Card title="Datos del paciente">
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <PatientFormFields patient={patient} />
            {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" loading={loading}>Guardar cambios</Button>
              <Link href={`/pacientes/${patient.id}`}>
                <Button type="button" variant="outline">Cancelar</Button>
              </Link>
              <Button type="button" variant="danger" onClick={handleDeactivate} className="ml-auto">
                Desactivar paciente
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
