"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PatientFormFields } from "@/components/pacientes/patient-form-fields";
import { createPatient } from "@/lib/actions/clinic";
import type { Clinic, UserRole } from "@/types/database";
import { ArrowLeft } from "lucide-react";

interface Props {
  clinics: { clinic_id: string; clinic?: Clinic }[];
  clinicId: string | null;
  role: UserRole | null;
  userName?: string;
  defaultInsurance?: string | null;
}

export default function NuevoPacienteForm({ clinics, clinicId, role, userName, defaultInsurance }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await createPatient(new FormData(e.currentTarget));
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      router.push(`/pacientes/${result.data.id}`);
    }
  }

  return (
    <>
      <Header
        title="Nuevo paciente"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={userName}
      />
      <div className="p-4 sm:p-6">
        <Link href="/pacientes" className="mb-4 inline-flex items-center gap-1 text-sm text-blue-700 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <Card title="Datos del paciente">
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <PatientFormFields defaultInsurance={defaultInsurance} />
            {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" loading={loading}>Guardar paciente</Button>
              <Link href="/pacientes">
                <Button type="button" variant="outline">Cancelar</Button>
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
