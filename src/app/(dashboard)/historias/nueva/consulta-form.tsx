"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ConsultationFlowBar } from "@/components/historias/consultation-flow-bar";
import { PamiPatientBanner } from "@/components/pacientes/pami-patient-banner";
import { createClinicalRecord } from "@/lib/actions/clinical-records";
import { startConsultationFromAppointment } from "@/lib/actions/appointments";
import {
  buildProfessionalSignature,
  getProfessionalDisplayName,
} from "@/lib/utils/professional";
import type { Clinic, Patient, Professional, UserRole } from "@/types/database";
import { ArrowLeft, Pill, ScrollText } from "lucide-react";
import { backHrefFromClinicalSubpage } from "@/lib/utils/clinical-navigation";
import {
  buildPharmacologyHrefFromConsultation,
  buildRecetasHrefFromConsultation,
  clearConsultationEvolution,
  consultationDraftKey,
  readConsultationEvolution,
  saveConsultationEvolution,
} from "@/lib/utils/consultation-draft";

interface Props {
  clinics: { clinic_id: string; clinic?: Clinic }[];
  clinicId: string | null;
  role: UserRole | null;
  userName?: string;
  patients: Patient[];
  professionals: Professional[];
  templates: Array<{
    id: string;
    name: string;
    chief_complaint_template: string | null;
    diagnosis_template: string | null;
    evolution_template: string | null;
    indications_template: string | null;
  }>;
  canIssuePrescriptions?: boolean;
}

export default function NuevaConsultaForm({
  clinics,
  clinicId,
  role,
  userName,
  patients,
  professionals,
  templates,
  canIssuePrescriptions = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultPatient = searchParams.get("patient") ?? "";
  const defaultProfessional = searchParams.get("professional") ?? "";
  const appointmentId = searchParams.get("appointment") ?? "";
  const fromClinical = searchParams.get("from");
  const backHref = backHrefFromClinicalSubpage(
    fromClinical,
    defaultPatient,
    "/historias"
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [professionalId, setProfessionalId] = useState(defaultProfessional);
  const [professionalSignature, setProfessionalSignature] = useState("");
  const [evolution, setEvolution] = useState("");

  const selectedPatient = patients.find((p) => p.id === defaultPatient);
  const fromAppointment = Boolean(appointmentId);

  const consultationContext = useMemo(() => {
    if (!defaultPatient) return null;
    const proId = fromAppointment ? defaultProfessional : professionalId;
    return {
      patientId: defaultPatient,
      appointmentId: appointmentId || undefined,
      professionalId: proId || undefined,
    };
  }, [
    defaultPatient,
    appointmentId,
    fromAppointment,
    defaultProfessional,
    professionalId,
  ]);

  const draftKey = useMemo(
    () => (consultationContext ? consultationDraftKey(consultationContext) : null),
    [consultationContext]
  );

  function signatureForProfessionalId(id: string): string {
    const pro = professionals.find((p) => p.id === id);
    return pro ? buildProfessionalSignature(pro) : "";
  }

  useEffect(() => {
    if (!appointmentId) return;
    startConsultationFromAppointment(appointmentId).then((result) => {
      if (result.error) setError(result.error);
    });
  }, [appointmentId]);

  useEffect(() => {
    const id = fromAppointment ? defaultProfessional : professionalId;
    if (id) setProfessionalSignature(signatureForProfessionalId(id));
  }, [fromAppointment, defaultProfessional, professionalId, professionals]);

  useEffect(() => {
    if (!draftKey) return;
    setEvolution(readConsultationEvolution(draftKey));
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey) return;
    const timer = window.setTimeout(() => saveConsultationEvolution(draftKey, evolution), 300);
    return () => window.clearTimeout(timer);
  }, [evolution, draftKey]);

  useEffect(() => {
    if (draftKey == null) return;
    const storageKey: string = draftKey;
    function syncFromStorage() {
      const saved = readConsultationEvolution(storageKey);
      setEvolution((prev) => (prev !== saved ? saved : prev));
    }
    document.addEventListener("visibilitychange", syncFromStorage);
    window.addEventListener("focus", syncFromStorage);
    return () => {
      document.removeEventListener("visibilitychange", syncFromStorage);
      window.removeEventListener("focus", syncFromStorage);
    };
  }, [draftKey]);

  function pharmacologyHref(mode?: "symptoms" | "pathology" | "vademecum") {
    if (!consultationContext) {
      return mode && mode !== "pathology"
        ? `/herramientas/farmacologia?mode=${mode}`
        : "/herramientas/farmacologia";
    }
    return buildPharmacologyHrefFromConsultation(consultationContext, mode);
  }

  function flushEvolutionDraft() {
    if (draftKey) saveConsultationEvolution(draftKey, evolution);
  }

  function recetaHref(tab: "receta" | "orden" = "receta") {
    if (!consultationContext) {
      return tab === "orden" ? "/recetas?tipo=orden" : "/recetas";
    }
    return buildRecetasHrefFromConsultation(consultationContext, tab);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    if (appointmentId) formData.set("appointment_id", appointmentId);
    formData.set("chief_complaint", "");
    formData.set("diagnosis", "");
    formData.set("indications", "");
    formData.set("professional_signature", professionalSignature);
    const result = await createClinicalRecord(formData);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      if (draftKey) clearConsultationEvolution(draftKey);
      router.push(`/historias/${result.data.id}`);
    }
  }

  function applyTemplate(templateId: string) {
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    const unified = [
      t.chief_complaint_template,
      t.diagnosis_template,
      t.evolution_template,
      t.indications_template,
    ]
      .filter(Boolean)
      .join("\n\n");
    setEvolution(unified);
  }

  return (
    <>
      <Header
        title={fromAppointment ? "Consulta en curso" : "Nueva consulta"}
        subtitle={
          fromAppointment
            ? "Flujo DrFlow: agenda → consulta → receta"
            : undefined
        }
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={userName}
      />
      <div className="space-y-4 p-4 sm:p-6">
        {!fromAppointment && (
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={backHref}
              className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
            >
              <ArrowLeft className="h-4 w-4" /> Volver
            </Link>
          </div>
        )}

        {fromAppointment && (
          <ConsultationFlowBar
            appointmentId={appointmentId}
            patient={selectedPatient}
            showSteps={false}
            recetaHref={canIssuePrescriptions && consultationContext ? recetaHref() : undefined}
            onRecetaClick={flushEvolutionDraft}
          />
        )}

        {selectedPatient && (
          <PamiPatientBanner patient={selectedPatient} />
        )}

        {templates.length > 0 && (
          <Select
            label="Plantilla por especialidad"
            options={templates.map((t) => ({ value: t.id, label: t.name }))}
            placeholder="Aplicar plantilla..."
            onChange={(e) => applyTemplate(e.target.value)}
          />
        )}

        <Card title={fromAppointment ? "Historia clínica" : "Registro de consulta"}>
          <form id="clinical-form" onSubmit={handleSubmit} className="grid gap-4">
            {appointmentId && <input type="hidden" name="appointment_id" value={appointmentId} />}

            {fromAppointment ? (
              <>
                <input type="hidden" name="patient_id" value={defaultPatient} />
                <input type="hidden" name="professional_id" value={defaultProfessional} />
              </>
            ) : (
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
                  value={professionalId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setProfessionalId(id);
                    setProfessionalSignature(signatureForProfessionalId(id));
                  }}
                  options={professionals.map((p) => ({
                    value: p.id,
                    label: getProfessionalDisplayName(p),
                  }))}
                  placeholder="Seleccionar"
                />
              </div>
            )}

            <Textarea
              name="evolution"
              label="Evolución"
              required
              rows={10}
              voiceInput
              value={evolution}
              onChange={(e) => setEvolution(e.target.value)}
            />

            <div className="flex flex-wrap gap-3 text-sm">
              <Link
                href={pharmacologyHref("symptoms")}
                onClick={flushEvolutionDraft}
                className="inline-flex items-center gap-1.5 text-violet-700 hover:underline"
              >
                <Pill className="h-4 w-4" />
                Buscar por síntomas
              </Link>
              <Link
                href={pharmacologyHref()}
                onClick={flushEvolutionDraft}
                className="inline-flex items-center gap-1.5 text-blue-700 hover:underline"
              >
                <Pill className="h-4 w-4" />
                Guía farmacológica
              </Link>
            </div>

            <Input
              name="professional_signature"
              label="Firma del profesional"
              value={professionalSignature}
              onChange={(e) => setProfessionalSignature(e.target.value)}
              placeholder="Dr/a. Nombre Apellido — Mat. XXXXX"
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={loading}>
                Guardar consulta
              </Button>
              {canIssuePrescriptions && consultationContext && (
                <Link
                  href={recetaHref()}
                  onClick={flushEvolutionDraft}
                  className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-800 hover:bg-teal-100"
                >
                  <ScrollText className="h-4 w-4" />
                  Generar receta
                </Link>
              )}
              {fromAppointment && (
                <Link
                  href="/agenda?view=day"
                  className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Volver a agenda
                </Link>
              )}
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
