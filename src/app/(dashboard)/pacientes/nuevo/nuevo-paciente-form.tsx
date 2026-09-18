"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Header } from "@/core/components/layout/header";

import { createPatient } from "@/features/pacientes/actions/patients";
import { PatientFormFields } from "@/features/pacientes/components/pacientes/patient-form-fields";
import { buildReturnPathWithPatient } from "@/features/pacientes/utils/create-patient-from-search";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Clinic, UserRole } from "@/types/database";

interface Props {
  clinics: { clinic_id: string; clinic?: Clinic }[];
  clinicId: string | null;
  role: UserRole | null;
  userName?: string;
  defaultInsurance?: string | null;
  acceptedCoverages?: string[] | null;
  prefill?: {
    first_name?: string;
    last_name?: string;
    document_number?: string;
  };
  returnPath?: string;
}

export default function NuevoPacienteForm({
  clinics,
  clinicId,
  role,
  userName,
  defaultInsurance,
  acceptedCoverages,
  prefill,
  returnPath,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [existingPatient, setExistingPatient] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const cancelHref = returnPath && returnPath.startsWith("/") ? returnPath : "/pacientes";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setExistingPatient(null);
    const result = await createPatient(new FormData(e.currentTarget));
    setLoading(false);
    if (result.error) {
      setError(result.error);
      if ("existingPatientId" in result && result.existingPatientId) {
        setExistingPatient({
          id: result.existingPatientId,
          name: result.existingPatientName ?? "Paciente existente",
        });
      }
    } else if (result.data) {
      const destination =
        returnPath && returnPath.startsWith("/")
          ? buildReturnPathWithPatient(returnPath, result.data.id)
          : `/pacientes/${result.data.id}`;
      router.push(destination);
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
        <Link
          href={cancelHref}
          className="mb-4 inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <Card title="Datos del paciente">
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <PatientFormFields
              defaultInsurance={defaultInsurance}
              acceptedCoverages={acceptedCoverages}
              prefill={prefill}
            />
            {error && (
              <div className="space-y-2 sm:col-span-2">
                <p className="text-sm text-red-600">{error}</p>
                {existingPatient ? (
                  <Link
                    href={`/pacientes/${existingPatient.id}`}
                    className="inline-flex text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800"
                  >
                    Abrir ficha de {existingPatient.name}
                  </Link>
                ) : (
                  <Link
                    href="/pacientes"
                    className="inline-flex text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800"
                  >
                    Ir a buscar en Pacientes
                  </Link>
                )}
              </div>
            )}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" loading={loading} pendingLabel="Guardando...">
                Guardar paciente
              </Button>
              <Link href={cancelHref}>
                <Button type="button" variant="outline">Cancelar</Button>
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
