"use client";

import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PatientWorkflowActionBar } from "@/features/ia/components/clinical-workflow/patient-workflow-action-bar";
import { clearConsultationTimer } from "@/features/historias/components/historias/consultation-timer";
import { finalizeConsultation } from "@/lib/actions/appointments";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

type Props = {
  patientId: string;
  canEditClinical: boolean;
  canIssue: boolean;
};

function PatientWorkflowActionBarInner({ patientId, canEditClinical, canIssue }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [finalizing, setFinalizing] = useState(false);

  const appointmentId = searchParams.get("appointment");
  const action = searchParams.get("action");
  const activeAppointmentId =
    appointmentId && action === "nueva" ? appointmentId : null;

  const onFinalizeConsult = useCallback(async () => {
    if (!activeAppointmentId) return;
    setFinalizing(true);
    const result = await finalizeConsultation(activeAppointmentId, "presencial");
    setFinalizing(false);
    if (!result.error) {
      clearConsultationTimer(activeAppointmentId);
      router.push(buildPatientWorkspaceUrl(patientId, { tab: "soap" }));
      router.refresh();
    }
  }, [activeAppointmentId, patientId, router]);

  return (
    <PatientWorkflowActionBar
      patientId={patientId}
      canEditClinical={canEditClinical}
      canIssue={canIssue}
      activeAppointmentId={activeAppointmentId}
      onFinalizeConsult={onFinalizeConsult}
      finalizing={finalizing}
    />
  );
}

export function PatientWorkflowActionBarHost(props: Props) {
  return (
    <Suspense fallback={null}>
      <PatientWorkflowActionBarInner {...props} />
    </Suspense>
  );
}
