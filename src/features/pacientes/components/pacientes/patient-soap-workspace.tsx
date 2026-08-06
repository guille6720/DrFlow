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
import {
  buildPatientWorkspaceUrl,
  parsePatientWorkspaceActions,
  type PatientWorkspaceFocus,
} from "@/features/pacientes/utils/patient-workspace-actions";

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
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parsed = useMemo(
    () => parsePatientWorkspaceActions("soap", searchParams),
    [searchParams]
  );

  const onConsultSaved = useCallback(
    (recordId: string) => {
      router.push(
        buildPatientWorkspaceUrl(patient.id, { tab: "soap", record: recordId, mode: "view" })
      );
      router.refresh();
    },
    [patient.id, router]
  );

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

  return (
    <PatientEhrStateProvider consultations={consultations} attachments={attachments}>
      <PatientEhrShellFrame embedded={embedded}>
        {!embedded ? <PatientEhrDemographics patient={patient} /> : null}
        <div className="drflow-ehr-print-demographics-wrap">
          <PatientEhrPrintDemographics patient={patient} />
        </div>

        <PatientEhrInteractiveBody
          patientId={patient.id}
          diagnosisRows={diagnosisRows}
          treatmentRows={treatmentRows}
          prescriptions={prescriptions}
          totalConsultations={totalConsultations}
          usesHceExport={usesHceExport}
          inlineConsultOpen={parsed.inlineConsultOpen}
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
              activeSheet={parsed.sheet}
              activeFocus={parsed.focus}
            />
          }
        />
      </PatientEhrShellFrame>
    </PatientEhrStateProvider>
  );
}
