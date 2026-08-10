"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

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
  buildPatientWorkspaceUrl,
  parsePatientWorkspaceActions,
  type PatientWorkspaceFocus,
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

type Props = PatientEhrViewProps & {
  patientRecord: Patient;
  professionals: PatientChartProfessional[];
  templates: Template[];
  defaultProfessionalId?: string | null;
  clinicalRecordsPagination?: PatientEhrClinicalRecordsPagination;
};

export function PatientSoapWorkspace({
  patient,
  consultations,
  diagnosisRows,
  treatmentRows,
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
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parsed = useMemo(
    () => parsePatientWorkspaceActions("soap", searchParams),
    [searchParams]
  );

  const onConsultSaved = useCallback((_recordId: string, silent?: boolean) => {
    if (!silent) router.refresh();
  }, [router]);

  const onCloseConsult = useCallback(() => {
    router.push(buildPatientWorkspaceUrl(patient.id, { tab: "soap" }), { scroll: false });
  }, [patient.id, router]);

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

  return (
    <PatientEhrStateProvider
      consultations={consultations}
      attachments={attachments}
      patient={patient}
      diagnosisRows={diagnosisRows}
      treatmentRows={treatmentRows}
      initialSelectedId={parsed.consulta}
      patientId={patient.id}
      clinicalRecordsPagination={clinicalRecordsPagination}
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
          prescriptions={prescriptions}
          totalConsultations={totalConsultations}
          usesHceExport={usesHceExport}
          inlineConsultOpen={parsed.inlineConsultOpen}
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
              saveLoading={form.loading}
              activeSheet={parsed.sheet}
              activeFocus={parsed.focus}
            />
          }
        />
      </PatientEhrShellFrame>
    </PatientEhrStateProvider>
  );
}
