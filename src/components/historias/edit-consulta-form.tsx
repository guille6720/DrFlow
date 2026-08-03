"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ConsultationFlowBar } from "@/components/historias/consultation-flow-bar";
import { PamiPatientBanner } from "@/components/pacientes/pami-patient-banner";
import { ConsultationAssistantPanel } from "@/components/historias/consultation-assistant-panel";
import { updateClinicalRecord } from "@/lib/actions/clinical-records";
import { buildUnifiedClinicalEvolution } from "@/lib/utils/unified-clinical-evolution";
import {
  buildPharmacologyHrefFromConsultation,
  buildRecetasHrefFromConsultation,
  clearConsultationEvolution,
  consultationDraftKey,
  readConsultationEvolution,
  saveConsultationEvolution,
} from "@/lib/utils/consultation-draft";
import type { Clinic, Patient, UserRole } from "@/types/database";
import { ArrowLeft, Pill, ScrollText } from "lucide-react";

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
  patient?: Patient | null;
  clinics: { clinic_id: string; clinic?: Clinic }[];
  clinicId: string | null;
  role: UserRole | null;
  userName?: string;
  backHref?: string;
  templates?: Array<{
    id: string;
    name: string;
    chief_complaint_template: string | null;
    diagnosis_template: string | null;
    evolution_template: string | null;
    indications_template: string | null;
  }>;
  canIssuePrescriptions?: boolean;
}

export function EditConsultaForm({
  record,
  patient,
  clinics,
  clinicId,
  role,
  userName,
  backHref = `/historias/${record.id}`,
  templates = [],
  canIssuePrescriptions = false,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [professionalSignature, setProfessionalSignature] = useState(
    record.professional_signature ?? ""
  );

  const initialEvolution = useMemo(
    () =>
      buildUnifiedClinicalEvolution({
        chief_complaint: record.chief_complaint,
        diagnosis: record.diagnosis,
        evolution: record.evolution,
        indications: record.indications,
      }),
    [record]
  );
  const [evolution, setEvolution] = useState(initialEvolution);

  const consultationContext = useMemo(
    () => ({
      patientId: record.patient_id,
      appointmentId: record.appointment_id ?? undefined,
      professionalId: record.professional_id,
      recordId: record.id,
    }),
    [record]
  );

  const draftKey = useMemo(() => consultationDraftKey(consultationContext), [consultationContext]);

  useEffect(() => {
    queueMicrotask(() => {
      const saved = readConsultationEvolution(draftKey);
      if (saved.trim()) {
        setEvolution(saved);
      } else {
        saveConsultationEvolution(draftKey, initialEvolution);
        setEvolution(initialEvolution);
      }
    });
  }, [draftKey, initialEvolution]);

  useEffect(() => {
    const timer = window.setTimeout(() => saveConsultationEvolution(draftKey, evolution), 300);
    return () => window.clearTimeout(timer);
  }, [evolution, draftKey]);

  useEffect(() => {
    const storageKey = draftKey;
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
    return buildPharmacologyHrefFromConsultation(consultationContext, mode);
  }

  function recetaHref(tab: "receta" | "orden" = "receta") {
    return buildRecetasHrefFromConsultation(consultationContext, tab);
  }

  function flushEvolutionDraft() {
    saveConsultationEvolution(draftKey, evolution);
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("chief_complaint", "");
    formData.set("diagnosis", "");
    formData.set("indications", "");
    formData.set("evolution", evolution);
    formData.set("professional_signature", professionalSignature);
    const result = await updateClinicalRecord(record.id, formData);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      clearConsultationEvolution(draftKey);
      router.push(`/historias/${record.id}`);
    }
  }

  return (
    <>
      <Header
        title="Editar consulta"
        subtitle={record.appointment_id ? "Flujo DrFlow: agenda → consulta → receta" : undefined}
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={userName}
      />
      <div className="space-y-4 p-4 sm:p-6">
        {!record.appointment_id && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
        )}

        {record.appointment_id && (
          <ConsultationFlowBar
            appointmentId={record.appointment_id}
            patient={patient}
            showSteps={false}
            recetaHref={canIssuePrescriptions ? recetaHref() : undefined}
            onRecetaClick={flushEvolutionDraft}
          />
        )}

        {patient && <PamiPatientBanner patient={patient} />}

        {templates.length > 0 && (
          <Select
            label="Plantilla por especialidad"
            options={templates.map((t) => ({ value: t.id, label: t.name }))}
            placeholder="Aplicar plantilla..."
            onChange={(e) => applyTemplate(e.target.value)}
          />
        )}

        <Card title="Actualizar consulta">
          <form onSubmit={handleSubmit} className="grid gap-4">
            <input type="hidden" name="patient_id" value={record.patient_id} />
            <input type="hidden" name="professional_id" value={record.professional_id} />
            {record.appointment_id && (
              <input type="hidden" name="appointment_id" value={record.appointment_id} />
            )}

            {patient ? (
              <ConsultationAssistantPanel
                patientId={record.patient_id}
                allergies={patient.allergies}
                regularMedication={patient.regular_medication}
                evolutionText={evolution}
                pharmacologyHref={pharmacologyHref()}
              />
            ) : null}

            <Textarea
              name="evolution"
              label="Evolución"
              required
              rows={12}
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
                Guardar cambios
              </Button>
              {canIssuePrescriptions && (
                <Link
                  href={recetaHref()}
                  onClick={flushEvolutionDraft}
                  className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-800 hover:bg-teal-100"
                >
                  <ScrollText className="h-4 w-4" />
                  Generar receta
                </Link>
              )}
              {record.appointment_id && (
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
