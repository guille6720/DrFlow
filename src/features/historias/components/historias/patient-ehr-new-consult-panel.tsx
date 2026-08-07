"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SignatureImage } from "@/core/components/ui/signature-image";

import { cn } from "@/shared/utils/cn";

import type { NuevaConsultaFormState } from "@/features/historias/hooks/use-nueva-consulta-form";
import type { PatientWorkspaceFocus } from "@/features/pacientes/utils/patient-workspace-actions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useClinicalDocumentsPanel } from "@/lib/hooks/use-clinical-documents-panel";
import { getProfessionalDisplayName } from "@/lib/utils/professional";

type FormProfessional = {
  id: string;
  display_name?: string | null;
  license_number?: string | null;
  profiles?: { full_name?: string } | null;
};

type Props = {
  patientId: string;
  form: NuevaConsultaFormState;
  professionals: FormProfessional[];
  templates: Array<{ id: string; name: string }>;
  focus?: PatientWorkspaceFocus | null;
  showArchivo?: boolean;
};

function sectionId(focus: PatientWorkspaceFocus) {
  return `ehr-consult-${focus}`;
}

export function PatientEhrNewConsultPanel({
  patientId,
  form,
  professionals,
  templates,
  focus,
  showArchivo = false,
}: Props) {
  const {
    evolution,
    setEvolution,
    professionalId,
    setProfessionalId,
    professionalSignature,
    setProfessionalSignature,
    professionalSignatureImageUrl,
    error,
    loading,
    handleSubmit,
    applyTemplate,
  } = form;

  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [vitals, setVitals] = useState("");
  const evolutionRef = useRef<HTMLTextAreaElement>(null);
  const diagnosisRef = useRef<HTMLTextAreaElement>(null);
  const treatmentRef = useRef<HTMLTextAreaElement>(null);
  const vitalsRef = useRef<HTMLTextAreaElement>(null);
  const {
    fileInputRef,
    uploading,
    error: uploadError,
    handleFileChange,
  } = useClinicalDocumentsPanel(patientId);

  const activeProfessional = professionals.find((p) => p.id === professionalId);

  useEffect(() => {
    const target =
      focus === "diagnostico"
        ? diagnosisRef
        : focus === "tratamiento"
          ? treatmentRef
          : focus === "vitales"
            ? vitalsRef
            : evolutionRef;
    target.current?.focus();
    target.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focus]);

  function buildMergedEvolution() {
    const parts: string[] = [];
    if (evolution.trim()) parts.push(evolution.trim());
    if (diagnosis.trim()) parts.push(`Diagnóstico: ${diagnosis.trim()}`);
    if (treatment.trim()) parts.push(`Tratamiento: ${treatment.trim()}`);
    if (vitals.trim()) parts.push(`Signos vitales: ${vitals.trim()}`);
    return parts.join("\n\n");
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const merged = buildMergedEvolution();
    if (evolutionRef.current) {
      evolutionRef.current.value = merged;
    }
    setEvolution(merged);
    void handleSubmit(e);
  }

  return (
    <div className="drflow-ehr-evolution-box mt-3 min-h-[240px] rounded-sm border p-4">
      <p className="mb-3 text-xs drflow-ehr-muted">
        {format(new Date(), "EEEE d MMMM yyyy · HH:mm", { locale: es })}
        {activeProfessional ? ` · ${getProfessionalDisplayName(activeProfessional)}` : null}
      </p>

      {templates.length > 0 ? (
        <div className="mb-3">
          <Select
            label="Plantilla"
            options={templates.map((t) => ({ value: t.id, label: t.name }))}
            placeholder="Aplicar plantilla..."
            onChange={(e) => applyTemplate(e.target.value)}
          />
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-3">
        <input type="hidden" name="patient_id" value={patientId} />
        <input type="hidden" name="professional_id" value={professionalId} />

        {professionals.length > 1 ? (
          <Select
            name="professional_id"
            label="Profesional"
            required
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
            options={professionals.map((p) => ({
              value: p.id,
              label: getProfessionalDisplayName(p),
            }))}
            placeholder="Seleccionar"
          />
        ) : null}

        <div id={sectionId("evolucion")}>
          <Textarea
            ref={evolutionRef}
            name="evolution"
            label="Evolución"
            required
            rows={6}
            voiceInput
            value={evolution}
            onChange={(e) => setEvolution(e.target.value)}
            className={cn(focus === "evolucion" && "ring-2 ring-teal-400/60")}
          />
        </div>

        <div id={sectionId("diagnostico")}>
          <Textarea
            ref={diagnosisRef}
            label="Diagnóstico"
            rows={2}
            voiceInput
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="Diagnóstico principal o presuntivo"
            className={cn(focus === "diagnostico" && "ring-2 ring-teal-400/60")}
          />
        </div>

        <div id={sectionId("tratamiento")}>
          <Textarea
            ref={treatmentRef}
            label="Tratamiento"
            rows={2}
            voiceInput
            value={treatment}
            onChange={(e) => setTreatment(e.target.value)}
            placeholder="Medicación, indicaciones y plan terapéutico"
            className={cn(focus === "tratamiento" && "ring-2 ring-teal-400/60")}
          />
        </div>

        <div id={sectionId("vitales")}>
          <Textarea
            ref={vitalsRef}
            label="Signos vitales"
            rows={2}
            voiceInput
            value={vitals}
            onChange={(e) => setVitals(e.target.value)}
            placeholder="TA, FC, FR, T°, Sat O₂, peso..."
            className={cn(focus === "vitales" && "ring-2 ring-teal-400/60")}
          />
        </div>

        {showArchivo ? (
          <div className="rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--ehr-panel)_96%,var(--ehr-label)_4%)] p-3">
            <p className="mb-2 text-xs font-semibold drflow-ehr-muted">Archivo adjunto</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Subir PDF o imagen
            </Button>
            {uploadError ? <p className="mt-2 text-xs text-red-600">{uploadError}</p> : null}
          </div>
        ) : null}

        <Input
          name="professional_signature"
          label="Firma del profesional"
          value={professionalSignature}
          onChange={(e) => setProfessionalSignature(e.target.value)}
          placeholder="Dr/a. Nombre Apellido — Mat. XXXXX"
        />
        {professionalSignatureImageUrl ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3">
            <SignatureImage
              src={professionalSignatureImageUrl}
              alt="Firma del profesional"
              className="max-h-16 max-w-[200px] object-contain"
            />
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="submit" loading={loading}>
            Guardar consulta
          </Button>
        </div>
      </form>
    </div>
  );
}
