"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ConsultationTimer } from "@/components/historias/consultation-timer";
import { createClinicalRecord, startConsultationFromAppointment } from "@/lib/actions/clinic";
import { getProfessionalDisplayName } from "@/lib/utils/professional";
import type { Clinic, Patient, Professional, UserRole } from "@/types/database";
import { ArrowLeft, AlertTriangle, Pill } from "lucide-react";

interface Props {
  clinics: { clinic_id: string; clinic?: Clinic }[];
  clinicId: string | null;
  role: UserRole | null;
  userName?: string;
  patients: Patient[];
  professionals: Professional[];
  templates: Array<{ id: string; name: string; chief_complaint_template: string | null; diagnosis_template: string | null; evolution_template: string | null; indications_template: string | null }>;
}

export default function NuevaConsultaForm({
  clinics,
  clinicId,
  role,
  userName,
  patients,
  professionals,
  templates,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultPatient = searchParams.get("patient") ?? "";
  const defaultProfessional = searchParams.get("professional") ?? "";
  const appointmentId = searchParams.get("appointment") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPrescription, setShowPrescription] = useState(false);

  useEffect(() => {
    if (!appointmentId) return;
    startConsultationFromAppointment(appointmentId).then((result) => {
      if (result.error) setError(result.error);
    });
  }, [appointmentId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    if (appointmentId) formData.set("appointment_id", appointmentId);
    const result = await createClinicalRecord(formData);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      router.push(`/historias/${result.data.id}`);
    }
  }

  function applyTemplate(templateId: string) {
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    const form = document.getElementById("clinical-form") as HTMLFormElement;
    if (!form) return;
    (form.elements.namedItem("chief_complaint") as HTMLTextAreaElement).value = t.chief_complaint_template ?? "";
    (form.elements.namedItem("diagnosis") as HTMLTextAreaElement).value = t.diagnosis_template ?? "";
    (form.elements.namedItem("evolution") as HTMLTextAreaElement).value = t.evolution_template ?? "";
    (form.elements.namedItem("indications") as HTMLTextAreaElement).value = t.indications_template ?? "";
  }

  return (
    <>
      <Header
        title="Nueva consulta"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={userName}
      />
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={appointmentId ? "/agenda?view=day" : "/historias"}
            className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
          {appointmentId && <ConsultationTimer storageKey={appointmentId} />}
        </div>

        {templates.length > 0 && (
          <Select
            label="Plantilla por especialidad"
            options={templates.map((t) => ({ value: t.id, label: t.name }))}
            placeholder="Aplicar plantilla..."
            onChange={(e) => applyTemplate(e.target.value)}
          />
        )}

        <Card title="Registro de consulta">
          <form id="clinical-form" onSubmit={handleSubmit} className="grid gap-4">
            {appointmentId && <input type="hidden" name="appointment_id" value={appointmentId} />}
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                name="patient_id"
                label="Paciente"
                required
                defaultValue={defaultPatient}
                options={patients.map((p) => ({
                  value: p.id,
                  label: `${p.last_name}, ${p.first_name}`,
                }))}
                placeholder="Seleccionar"
              />
              <Select
                name="professional_id"
                label="Profesional"
                required
                defaultValue={defaultProfessional}
                options={professionals.map((p) => ({
                  value: p.id,
                  label: getProfessionalDisplayName(p),
                }))}
                placeholder="Seleccionar"
              />
            </div>
            <Textarea name="chief_complaint" label="Motivo de consulta" required />
            <div className="flex flex-wrap gap-3 text-sm">
              <Link
                href="/herramientas/farmacologia?mode=symptoms"
                className="inline-flex items-center gap-1.5 text-violet-700 hover:underline"
              >
                <Pill className="h-4 w-4" />
                Buscar patología por síntomas
              </Link>
              <Link
                href="/herramientas/farmacologia"
                className="inline-flex items-center gap-1.5 text-teal-700 hover:underline"
              >
                <Pill className="h-4 w-4" />
                Guía farmacológica
              </Link>
            </div>
            <Textarea name="diagnosis" label="Diagnóstico" />
            <Textarea name="evolution" label="Evolución" />
            <Textarea name="indications" label="Indicaciones" />
            <Input name="professional_signature" label="Firma del profesional (texto)" placeholder="Dr/a. Nombre Apellido — Mat. XXXXX" />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={loading}>Guardar consulta</Button>
              <Button type="button" variant="outline" onClick={() => setShowPrescription(!showPrescription)}>
                Borrador de prescripción
              </Button>
            </div>
          </form>
        </Card>

        {showPrescription && (
          <Card title="Borrador de prescripción">
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p>
                <strong>Aviso legal:</strong> Este documento no tiene validez como receta electrónica oficial hasta que la plataforma esté aprobada por la autoridad correspondiente.
              </p>
            </div>
            <p className="text-sm text-slate-500">
              El borrador de prescripción se habilitará tras guardar la consulta. Desde el detalle podrás emitir la <strong>receta electrónica (Argentina)</strong> con CIE-10, genéricos y PDF.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}
