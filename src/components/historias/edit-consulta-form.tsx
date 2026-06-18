"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { updateClinicalRecord } from "@/lib/actions/clinic";
import type { Clinic, UserRole } from "@/types/database";
import { ArrowLeft } from "lucide-react";

interface RecordData {
  id: string;
  patient_id: string;
  professional_id: string;
  appointment_id: string | null;
  chief_complaint: string | null;
  diagnosis: string | null;
  evolution: string | null;
  indications: string | null;
  professional_signature: string | null;
}

interface Props {
  record: RecordData;
  clinics: { clinic_id: string; clinic?: Clinic }[];
  clinicId: string | null;
  role: UserRole | null;
  userName?: string;
}

export function EditConsultaForm({ record, clinics, clinicId, role, userName }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await updateClinicalRecord(record.id, new FormData(e.currentTarget));
    setLoading(false);
    if (result.error) setError(result.error);
    else router.push(`/historias/${record.id}`);
  }

  return (
    <>
      <Header title="Editar consulta" clinics={clinics} activeClinicId={clinicId} role={role} userName={userName} />
      <div className="p-4 sm:p-6">
        <Link href={`/historias/${record.id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-blue-700 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <Card title="Actualizar consulta">
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="hidden" name="patient_id" value={record.patient_id} />
            <input type="hidden" name="professional_id" value={record.professional_id} />
            {record.appointment_id && (
              <input type="hidden" name="appointment_id" value={record.appointment_id} />
            )}
            <Textarea name="chief_complaint" label="Motivo de consulta" defaultValue={record.chief_complaint ?? ""} />
            <Textarea name="diagnosis" label="Diagnóstico" defaultValue={record.diagnosis ?? ""} />
            <Textarea name="evolution" label="Evolución" defaultValue={record.evolution ?? ""} />
            <Textarea name="indications" label="Indicaciones" defaultValue={record.indications ?? ""} />
            <Input name="professional_signature" label="Firma profesional" defaultValue={record.professional_signature ?? ""} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" loading={loading}>Guardar cambios</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
