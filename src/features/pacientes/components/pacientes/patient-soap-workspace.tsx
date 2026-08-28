"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";

import { PatientEhrActionLinks } from "@/features/historias/components/historias/patient-ehr-action-links";
import { PatientEhrDemographics } from "@/features/historias/components/historias/patient-ehr-demographics";
import { PatientEhrInteractiveBody } from "@/features/historias/components/historias/patient-ehr-interactive-body";
import { PatientEhrNewConsultPanel } from "@/features/historias/components/historias/patient-ehr-new-consult-panel";
import { PatientEhrPrintDemographics } from "@/features/historias/components/historias/patient-ehr-print-demographics";
import { PatientEhrShellFrame } from "@/features/historias/components/historias/patient-ehr-shell-frame";
import { PatientEhrStateProvider } from "@/features/historias/components/historias/patient-ehr-state-context";
import type { PatientEhrViewProps } from "@/features/historias/components/historias/patient-ehr-types";
import { useNuevaConsultaForm } from "@/features/historias/hooks/use-nueva-consulta-form";
import type { PatientChartProfessional } from "@/features/pacientes/components/pacientes/patient-chart-view-types";
import type { PatientEhrClinicalRecordsPagination } from "@/features/pacientes/server/load-patient-ehr-data";
import {
  buildConsultaSessionUrl,
  buildPatientWorkspaceUrl,
  parsePatientWorkspaceActions,
  type PatientWorkspaceFocus,
  type PatientWorkspaceSheet,
} from "@/features/pacientes/utils/patient-workspace-actions";

import { getProfessionalDisplayName } from "@/lib/utils/professional";
import type { Patient } from "@/types/database";

type Template = {
  id: string;
  name: string;
  chief_complaint_template: string | null;
  diagnosis_template: string | null;
  evolution_template: string | null;
  indications_template: string | null;
};

type ConsultasSession = {
  appointmentId: string;
  professionalId?: string | null;
};

type Props = PatientEhrViewProps & {
  patientRecord: Patient;
  professionals: PatientChartProfessional[];
  templates: Template[];
  defaultProfessionalId?: string | null;
  clinicalRecordsPagination?: PatientEhrClinicalRecordsPagination;
  canIssue?: boolean;
  /** Evolución en Médicos → Consultas (no en Historias / HC del paciente). */
  consultasSession?: ConsultasSession | null;
};

export function PatientSoapWorkspace({
  patient,
  consultations,
  diagnosisRows,
  treatmentRows,
  problemList = [],
  attachments,
  prescriptions,
  totalConsultations,
  usesHceExport = false,
  embedded = false,
  patientRecord,
  professionals,
  templates,
  defaultProfessionalId,
  clinicalRecordsPagination,
  canIssue = false,
  consultasSession = null,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parsedBase = useMemo(
    () => parsePatientWorkspaceActions("soap", searchParams),
    [searchParams]
  );

  const parsed = useMemo(() => {
    if (!consultasSession) return parsedBase;
    return {
      ...parsedBase,
      inlineConsultOpen: true,
      action: "nueva" as const,
      appointment: consultasSession.appointmentId || parsedBase.appointment,
      professional:
        consultasSession.professionalId ??
        parsedBase.professional ??
        defaultProfessionalId ??
        null,
    };
  }, [consultasSession, defaultProfessionalId, parsedBase]);

  // La evolución en curso vive en /consultas; redirigir desde HC del paciente.
  useEffect(() => {
    if (consultasSession) return;
    if (!parsedBase.inlineConsultOpen) return;
    router.replace(
      buildConsultaSessionUrl({
        appointment: parsedBase.appointment ?? undefined,
        patient: patient.id,
        professional: parsedBase.professional ?? defaultProfessionalId ?? undefined,
        sheet: parsedBase.sheet ?? undefined,
        focus: parsedBase.focus ?? undefined,
      })
    );
  }, [
    consultasSession,
    defaultProfessionalId,
    parsedBase.focus,
    parsedBase.appointment,
    parsedBase.inlineConsultOpen,
    parsedBase.professional,
    parsedBase.sheet,
    patient.id,
    router,
  ]);

  const buildConsultHref = useCallback(
    (opts?: {
      sheet?: PatientWorkspaceSheet;
      focus?: PatientWorkspaceFocus;
      consulta?: string;
    }) => {
      if (consultasSession) {
        return buildConsultaSessionUrl({
          appointment: consultasSession.appointmentId,
          patient: patient.id,
          professional:
            consultasSession.professionalId ?? defaultProfessionalId ?? undefined,
          sheet: opts?.sheet,
          focus: opts?.focus,
          consulta: opts?.consulta,
        });
      }
      return buildConsultaSessionUrl({
        patient: patient.id,
        professional: defaultProfessionalId ?? undefined,
        sheet: opts?.sheet,
        focus: opts?.focus,
        consulta: opts?.consulta,
      });
    },
    [consultasSession, defaultProfessionalId, patient.id]
  );

  const onConsultSaved = useCallback(
    (_recordId: string, silent?: boolean) => {
      if (!silent) router.refresh();
    },
    [router]
  );

  const onCloseConsult = useCallback(() => {
    if (consultasSession) {
      router.push("/consultas", { scroll: false });
      return;
    }
    router.push(buildPatientWorkspaceUrl(patient.id, { tab: "soap" }), { scroll: false });
  }, [consultasSession, patient.id, router]);

  const form = useNuevaConsultaForm({
    patients: [patientRecord],
    professionals,
    templates,
    fallbackProfessionalId: defaultProfessionalId ?? undefined,
    workspace: parsed.inlineConsultOpen
      ? {
          patientId: patient.id,
          appointmentId: parsed.appointment ?? undefined,
          professionalId: parsed.professional ?? defaultProfessionalId ?? undefined,
          onSaved: onConsultSaved,
          onClose: onCloseConsult,
        }
      : undefined,
  });

  const consultFocus: PatientWorkspaceFocus | null =
    parsed.focus ?? (parsed.inlineConsultOpen ? "evolucion" : null);

  const activeProfessional = professionals.find(
    (p) => p.id === (form.professionalId || defaultProfessionalId)
  );
  const pendingSidebarConsultation = parsed.inlineConsultOpen
    ? {
        createdAt: new Date(form.consultationAt).toISOString(),
        professionalName: activeProfessional
          ? getProfessionalDisplayName(activeProfessional)
          : "Consulta en curso",
      }
    : null;

  const printClinicalContext = useMemo(
    () => ({
      allergies: patientRecord.allergies,
      medicalHistory: patientRecord.medical_history,
      regularMedication: patientRecord.regular_medication,
      problemList,
    }),
    [patientRecord.allergies, patientRecord.medical_history, patientRecord.regular_medication, problemList]
  );

  // Mientras redirige desde HC, no montar el formulario ahí.
  if (!consultasSession && parsedBase.inlineConsultOpen) {
    return (
      <PatientEhrShellFrame embedded={embedded}>
        <p className="p-4 text-sm drflow-ehr-muted">Abriendo evolución en Consultas…</p>
      </PatientEhrShellFrame>
    );
  }

  return (
    <PatientEhrStateProvider
      key={patient.id}
      consultations={consultations}
      attachments={attachments}
      patient={patient}
      diagnosisRows={diagnosisRows}
      treatmentRows={treatmentRows}
      initialSelectedId={parsed.consulta}
      patientId={patient.id}
      clinicalRecordsPagination={clinicalRecordsPagination}
      professionals={professionals}
      clinicalContext={printClinicalContext}
    >
      <PatientEhrShellFrame embedded={embedded}>
        {!embedded ? (
          <PatientEhrDemographics patient={patient} totalConsultations={totalConsultations} />
        ) : null}
        <div className="drflow-ehr-print-demographics-wrap">
          <PatientEhrPrintDemographics
            patient={patient}
            totalConsultations={totalConsultations}
          />
        </div>

        <PatientEhrInteractiveBody
          patientId={patient.id}
          diagnosisRows={diagnosisRows}
          treatmentRows={treatmentRows}
          problemList={problemList}
          prescriptions={prescriptions}
          totalConsultations={totalConsultations}
          usesHceExport={usesHceExport}
          inlineConsultOpen={parsed.inlineConsultOpen}
          canIssue={canIssue}
          pendingSidebarConsultation={pendingSidebarConsultation}
          consultPanel={
            parsed.inlineConsultOpen ? (
              <PatientEhrNewConsultPanel
                patientId={patient.id}
                form={form}
                professionals={professionals}
                templates={templates}
                focus={consultFocus}
                showArchivo={parsed.sheet === "archivo"}
              />
            ) : undefined
          }
          actionLinks={
            <PatientEhrActionLinks
              patientId={patient.id}
              consultOpen={parsed.inlineConsultOpen}
              historyOnly={!consultasSession && !parsed.inlineConsultOpen}
              saveLoading={form.loading}
              activeSheet={parsed.sheet}
              activeFocus={parsed.focus}
              canIssue={canIssue}
              selectedConsultaId={parsed.consulta}
              buildHref={consultasSession ? buildConsultHref : undefined}
              onBeforeRecetaOpen={parsed.inlineConsultOpen ? form.flushEvolutionDraft : undefined}
            />
          }
        />
      </PatientEhrShellFrame>
    </PatientEhrStateProvider>
  );
}
