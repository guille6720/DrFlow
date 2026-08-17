"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";

import { toast } from "@/core/notifications/toast";

import { DrappConsultaWorkspace } from "@/features/historias/components/consultas/drapp-consulta-workspace";
import { clearConsultationTimer } from "@/features/historias/components/historias/consultation-timer";
import type { PatientWorkspacePagePayload } from "@/features/pacientes/server/load-patient-workspace-page";
import {
  buildConsultaSessionUrl,
  type PatientWorkspaceUrlOptions,
} from "@/features/pacientes/utils/patient-workspace-actions";

import { ButtonLink } from "@/components/ui/button";
import { finalizeConsultation } from "@/lib/actions/appointments";
import { updateWaitingRoomStatus } from "@/lib/actions/waiting-room";
import type { Patient } from "@/types/database";

const PatientWorkspaceSheets = dynamic(
  () =>
    import("@/features/pacientes/components/pacientes/workspace/patient-workspace-sheets").then(
      (m) => ({ default: m.PatientWorkspaceSheets })
    ),
  { loading: () => null }
);

type Props = {
  appointmentId?: string | null;
  professionalId: string;
  patientRecord: Patient;
  patientDisplayName: string;
  clinicalHistoryHref: string;
  workspace: PatientWorkspacePagePayload;
  canIssue: boolean;
  canEditClinical: boolean;
  clinic: {
    name: string;
    address?: string | null;
    phone?: string | null;
  };
};

export function DoctorConsultaSession({
  appointmentId = null,
  professionalId,
  patientRecord,
  patientDisplayName,
  clinicalHistoryHref,
  workspace,
  canIssue,
  canEditClinical,
  clinic,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [finalizing, setFinalizing] = useState(false);
  const [, startTransition] = useTransition();

  const patientId = patientRecord.id;
  const ehr = workspace.ehr;

  const navigateWorkspace = useCallback(
    (opts: PatientWorkspaceUrlOptions) => {
      router.push(
        buildConsultaSessionUrl({
          appointment: appointmentId ?? undefined,
          patient: patientId,
          professional: opts.professional ?? professionalId,
          sheet: opts.sheet,
          focus: opts.focus,
          consulta: opts.consulta,
        }),
        { scroll: false }
      );
    },
    [appointmentId, patientId, professionalId, router]
  );

  const workspaceNavigation = useMemo(
    () => ({
      workspaceSearchParams: searchParams,
      navigateWorkspace,
    }),
    [navigateWorkspace, searchParams]
  );

  async function handleFinalize() {
    if (!appointmentId) {
      router.push("/consultas");
      return;
    }
    setFinalizing(true);
    const result = await finalizeConsultation(appointmentId, "presencial");
    if (result.error) {
      toast.error(result.error);
      setFinalizing(false);
      return;
    }
    try {
      await updateWaitingRoomStatus(appointmentId, "finished");
    } catch {
      // non-blocking
    }
    clearConsultationTimer(appointmentId);
    toast.success("Consulta guardada y turno finalizado");
    startTransition(() => {
      router.push("/consultas");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ButtonLink href="/consultas" variant="outline" size="sm">
          ← Lista de consultas
        </ButtonLink>
        <ButtonLink href="/sala-espera" variant="outline" size="sm">
          Sala de espera
        </ButtonLink>
        <ButtonLink href={clinicalHistoryHref} variant="secondary" size="sm">
          Historia clínica de: {patientDisplayName}
        </ButtonLink>
      </div>

      <DrappConsultaWorkspace
        key={`${patientId}:${appointmentId ?? ""}`}
        patient={ehr.patientInfo}
        consultations={ehr.consultations}
        diagnosisRows={ehr.diagnosisRows}
        treatmentRows={ehr.treatmentRows}
        attachments={ehr.attachments}
        prescriptions={ehr.prescriptions}
        totalConsultations={ehr.totalConsultations}
        usesHceExport={ehr.usesHceExport}
        patientRecord={patientRecord}
        professionals={workspace.professionals}
        templates={workspace.templates}
        defaultProfessionalId={professionalId || workspace.defaultProfessionalId}
        clinicalRecordsPagination={ehr.clinicalRecordsPagination}
        canIssue={canIssue}
        appointmentId={appointmentId}
        professionalId={professionalId}
        finalizing={finalizing}
        onFinalize={appointmentId ? () => void handleFinalize() : undefined}
        onOpenSheet={(sheet) => {
          navigateWorkspace({
            tab: "soap",
            action: "nueva",
            appointment: appointmentId ?? undefined,
            professional: professionalId,
            sheet,
            focus: sheet === "archivo" ? "evolucion" : undefined,
          });
        }}
      />

      <PatientWorkspaceSheets
        activeTab="soap"
        workspaceNavigation={workspaceNavigation}
        patient={workspace.patient}
        patientId={patientId}
        patientRecord={patientRecord}
        ehr={ehr}
        professionals={workspace.professionals}
        defaultProfessionalId={professionalId || workspace.defaultProfessionalId}
        lastMedications={workspace.lastMedications}
        templates={workspace.templates}
        canIssue={canIssue}
        chart={workspace.chart}
        coverageRuleOverrides={workspace.coverageRuleOverrides}
        clinic={clinic}
        canEditClinical={canEditClinical}
      />
    </div>
  );
}
