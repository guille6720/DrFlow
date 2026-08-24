"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  confirmPatientImportSession,
  createPatientImportSession,
  downloadPatientImportErrorCsv,
  listImportMappingTemplates,
  saveImportMappingTemplate,
  savePatientImportDecisions,
  savePatientImportMapping,
  validatePatientImportSession,
} from "@/features/integraciones/actions/patient-import-session";
import { downloadTextFile } from "@/features/integraciones/components/datos/download-file";
import { PatientImportDuplicatesStep } from "@/features/integraciones/components/datos/patient-import-duplicates-step";
import {
  PatientImportConfirmStep,
  PatientImportResultStep,
  PatientImportStatus,
  PatientImportStepper,
  PatientImportUploadStep,
} from "@/features/integraciones/components/datos/patient-import-flow-steps";
import { PatientImportMappingStep } from "@/features/integraciones/components/datos/patient-import-mapping-step";
import { PatientImportValidationStep } from "@/features/integraciones/components/datos/patient-import-validation-step";
import {
  defaultDuplicateDecisions,
  type DuplicateDecisionSet,
  type PatientDuplicateCandidate,
} from "@/features/integraciones/lib/patient-import-duplicates";
import type { PatientColumnMapping } from "@/features/integraciones/lib/patient-import-mapping";
import type { DataImportSessionRow } from "@/features/integraciones/server/data-import-types";

const STEPS = ["Subida", "Mapeo", "Validación", "Duplicados", "Confirmación", "Resultado"] as const;
const ACCEPT = ".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";

type Props = { canImport: boolean };

export function PatientImportWizard({ canImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<DataImportSessionRow | null>(null);
  const [mapping, setMapping] = useState<PatientColumnMapping>({});
  const [dateFormat, setDateFormat] = useState("dmy");
  const [decisions, setDecisions] = useState<DuplicateDecisionSet>(defaultDuplicateDecisions());
  const [templateName, setTemplateName] = useState("");
  const [appliedTemplateName, setAppliedTemplateName] = useState<string | null>(null);
  const [templates, setTemplates] = useState<
    Array<{ id: string; name: string; mapping: PatientColumnMapping }>
  >([]);
  const [jobId, setJobId] = useState<string | null>(null);

  useEffect(() => {
    if (!canImport) return;
    void listImportMappingTemplates().then((result) => {
      if (result.templates) setTemplates(result.templates);
    });
  }, [canImport]);

  const headerOptions = useMemo(() => {
    const headers = session?.headers ?? [];
    return [{ value: "", label: "— no mapear —" }, ...headers.map((header) => ({ value: header, label: header }))];
  }, [session?.headers]);

  if (!canImport) {
    return <p className="text-sm text-slate-600">No tenés permiso para importar pacientes.</p>;
  }

  async function onUpload(file: File) {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("file", file);
    const result = await createPatientImportSession(form);
    setBusy(false);
    if (result.error || !result.session) {
      setError(result.error ?? "No se pudo leer el archivo.");
      return;
    }
    setSession(result.session);
    setMapping(result.session.column_mapping);
    setDateFormat(result.session.date_format || "dmy");
    setAppliedTemplateName(result.suggestedTemplateName ?? null);
    setStep(1);
  }

  async function onSaveMapping() {
    if (!session) return;
    setBusy(true);
    setError(null);
    const result = await savePatientImportMapping(session.id, mapping, dateFormat);
    if (result.error || !result.session) {
      setBusy(false);
      setError(result.error ?? "Revisá el mapeo.");
      return;
    }
    setSession(result.session);
    setStep(2);
    const validated = await validatePatientImportSession(result.session.id);
    setBusy(false);
    if (validated.error || !validated.session) {
      setError(validated.error ?? "Validación fallida.");
      return;
    }
    setSession(validated.session);
  }

  async function onSaveDecisions() {
    if (!session) return;
    setBusy(true);
    const result = await savePatientImportDecisions(session.id, decisions);
    setBusy(false);
    if (result.error || !result.session) {
      setError(result.error ?? "No se guardaron las decisiones.");
      return;
    }
    setSession(result.session);
    setStep(4);
  }

  async function onConfirm() {
    if (!session) return;
    setBusy(true);
    setError(null);
    const result = await confirmPatientImportSession(session.id);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setJobId(result.jobId ?? null);
    if (result.session) setSession(result.session);
    setStep(5);
  }

  const stats = session?.stats;
  const duplicates = (session?.duplicate_sample ?? []) as PatientDuplicateCandidate[];

  return (
    <div className="space-y-4">
      <PatientImportStepper steps={STEPS} current={step} />

      {step === 0 && (
        <PatientImportUploadStep
          fileRef={fileRef}
          accept={ACCEPT}
          busy={busy}
          onPick={() => {
            const file = fileRef.current?.files?.[0];
            if (file) void onUpload(file);
          }}
        />
      )}

      {step === 1 && session && (
        <PatientImportMappingStep
          fileName={session.original_filename}
          total={session.stats.total}
          appliedTemplateName={appliedTemplateName}
          templates={templates}
          mapping={mapping}
          dateFormat={dateFormat}
          headerOptions={headerOptions}
          templateName={templateName}
          busy={busy}
          onMappingChange={setMapping}
          onDateFormatChange={setDateFormat}
          onTemplateNameChange={setTemplateName}
          onApplyTemplate={(template) => {
            setMapping(template.mapping);
            setAppliedTemplateName(template.name);
          }}
          onSaveTemplate={() => void saveImportMappingTemplate(templateName, mapping, dateFormat)}
          onValidate={() => void onSaveMapping()}
        />
      )}

      {step === 2 && session && (
        <PatientImportValidationStep
          session={session}
          busy={busy}
          onNext={() => setStep(stats && stats.duplicates > 0 ? 3 : 4)}
          onErrors={() => {
            void downloadPatientImportErrorCsv(session.id).then((result) => {
              if (result.csv && result.fileName) {
                downloadTextFile(result.fileName, "text/csv;charset=utf-8", result.csv);
              }
            });
          }}
        />
      )}

      {step === 3 && session && (
        <PatientImportDuplicatesStep
          duplicates={duplicates}
          totalDuplicates={session.stats.duplicates}
          decisions={decisions}
          busy={busy}
          onChange={setDecisions}
          onNext={() => void onSaveDecisions()}
        />
      )}

      {step === 4 && session && (
        <PatientImportConfirmStep session={session} busy={busy} onConfirm={() => void onConfirm()} />
      )}

      {step === 5 && <PatientImportResultStep session={session} jobId={jobId} />}
      <PatientImportStatus busy={busy && step !== 0} error={error} />
    </div>
  );
}
