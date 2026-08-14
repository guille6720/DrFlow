"use client";

import { useEffect, useMemo } from "react";

import { useClinicalCopilot } from "@/features/ia/components/clinical-workflow/clinical-copilot-context";
import { ClinicalCopilotSessionSync } from "@/features/ia/components/clinical-workflow/clinical-copilot-session-sync";
import type { PatientWorkspaceViewProps } from "@/features/pacientes/components/pacientes/patient-workspace-types";
import type { PatientWorkspaceTabId } from "@/features/pacientes/constants/patient-workspace-tabs";
import { usePatientWorkspaceActions } from "@/features/pacientes/hooks/use-patient-workspace-actions";
import type { PatientWorkspaceUrlOptions } from "@/features/pacientes/utils/patient-workspace-actions";

type Props = Pick<
  PatientWorkspaceViewProps,
  "patient" | "patientId" | "chart" | "ehr" | "patientRecord" | "lastMedications"
> & {
  activeTab: PatientWorkspaceTabId;
  patientName: string;
  workspaceNavigation: {
    workspaceSearchParams: URLSearchParams;
    navigateWorkspace: (opts: PatientWorkspaceUrlOptions) => void;
  };
};

function CopilotUrlOpener({ open }: { open: boolean }) {
  const { setOpen } = useClinicalCopilot();

  useEffect(() => {
    if (open) setOpen(true);
  }, [open, setOpen]);

  return null;
}

/** Bridges patient workspace data into the global clinical copilot session. */
export function PatientWorkspaceCopilotBridge({
  activeTab,
  patient,
  patientId,
  patientName,
  chart,
  ehr,
  patientRecord,
  lastMedications,
  workspaceNavigation,
}: Props) {
  const actions = usePatientWorkspaceActions(patientId, activeTab, workspaceNavigation);
  const lastConsult = ehr.consultations[0];

  const assistContext = useMemo(
    () => ({
      patientName,
      allergies: patientRecord.allergies,
      regularMedication: patientRecord.regular_medication,
      medicalHistory: patientRecord.medical_history,
      lastEvolution: lastConsult?.evolution ?? null,
      lastDiagnosis: lastConsult?.diagnosis ?? ehr.diagnosisRows[0]?.name ?? null,
      activeProblems:
        ehr.problemList.length > 0
          ? ehr.problemList.map((p) => p.name).slice(0, 6)
          : ehr.diagnosisRows.map((d) => d.name).slice(0, 6),
      insurance: patient.insurance_provider ?? undefined,
      insurancePlan: patientRecord.insurance_plan,
      chiefComplaint: lastConsult?.chief_complaint ?? null,
      diagnosis: lastConsult?.diagnosis ?? null,
      evolutionText: lastConsult?.evolution ?? undefined,
      proposedMedications: lastMedications?.map((m) => m.generic_name || m.brand_name || "").filter(Boolean),
    }),
    [
      patientName,
      patientRecord,
      lastConsult,
      ehr.diagnosisRows,
      ehr.problemList,
      patient.insurance_provider,
      lastMedications,
    ]
  );

  const recentConsultations = useMemo(
    () =>
      chart.consultations.map((c) => ({
        dateLabel: c.dateLabel,
        motive: c.motive,
        diagnosis: c.diagnosis,
      })),
    [chart.consultations]
  );

  const lastPrescriptionLines = useMemo(() => {
    const rx = ehr.prescriptions[0];
    if (rx?.label) return rx.label.split(/[\n;]+/).map((s) => s.trim()).filter(Boolean);
    if (lastMedications?.length) {
      return lastMedications.map((m) => m.generic_name || m.brand_name || "Medicamento").filter(Boolean);
    }
    return [];
  }, [ehr.prescriptions, lastMedications]);

  return (
    <>
      <ClinicalCopilotSessionSync
        patientId={patientId}
        patientName={patientName}
        chart={chart}
        lastConsultAt={lastConsult?.created_at ?? null}
        recentConsultations={recentConsultations}
        lastPrescriptionLines={lastPrescriptionLines}
        assistContext={assistContext}
      />
      <CopilotUrlOpener open={actions.copilotSheetOpen} />
    </>
  );
}
