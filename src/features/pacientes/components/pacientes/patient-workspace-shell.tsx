"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { ClinicalWorkspaceView } from "@/features/pacientes/components/pacientes/clinical-workspace/clinical-workspace-view";
import type { PatientChartPatient } from "@/features/pacientes/components/pacientes/patient-chart-view-types";
import { PatientClinicalAuditPanel } from "@/features/pacientes/components/pacientes/patient-clinical-audit-panel";
import { PatientSoapWorkspace } from "@/features/pacientes/components/pacientes/patient-soap-workspace";
import { PatientWorkspaceAdminDocsPanel } from "@/features/pacientes/components/pacientes/patient-workspace-admin-docs-panel";
import { PatientWorkspaceChartPanel } from "@/features/pacientes/components/pacientes/patient-workspace-chart-panel";
import { PatientWorkspaceDiagnosticsPanel } from "@/features/pacientes/components/pacientes/patient-workspace-diagnostics-panel";
import { PatientWorkspaceOrdersPanel } from "@/features/pacientes/components/pacientes/patient-workspace-orders-panel";
import { PatientWorkspacePanelSkeleton } from "@/features/pacientes/components/pacientes/patient-workspace-panel-skeleton";
import { PatientWorkspacePrescriptionsPanel } from "@/features/pacientes/components/pacientes/patient-workspace-prescriptions-panel";
import { PatientWorkspaceTimelinePanel } from "@/features/pacientes/components/pacientes/patient-workspace-timeline-panel";
import { PatientWorkspaceView } from "@/features/pacientes/components/pacientes/patient-workspace-view";
import type { PatientWorkspaceTabId } from "@/features/pacientes/constants/patient-workspace-tabs";
import { usePatientWorkspaceTab } from "@/features/pacientes/hooks/use-patient-workspace-tab";
import type { PatientWorkspacePagePayload } from "@/features/pacientes/server/load-patient-workspace-page";
import {
  loadPatientWorkspaceTabPanel,
  type PatientWorkspaceAdminDocumentRow,
} from "@/features/pacientes/server/load-patient-workspace-tab-panel";
import { chartFocusForTab } from "@/features/pacientes/utils/patient-workspace-tab-routing";

import type { Patient } from "@/types/database";

type AuditTrailState = {
  data?: import("@/core/security/audit-types").PatientAuditEvent[];
  error?: string | null;
  nextCursor?: string | null;
  hasMore?: boolean;
};

type TabCacheEntry = {
  workspace: PatientWorkspacePagePayload;
  adminDocuments?: PatientWorkspaceAdminDocumentRow[];
  auditTrail?: AuditTrailState | null;
};

type Props = {
  clinicId: string;
  clinic: {
    name: string;
    address?: string | null;
    phone?: string | null;
  };
  patient: PatientChartPatient & {
    medical_history: string | null;
    allergies: string | null;
    regular_medication: string | null;
    notes: string | null;
  };
  patientRecord: Patient;
  patientId: string;
  initialTab: PatientWorkspaceTabId;
  initialWorkspace: PatientWorkspacePagePayload;
  initialAdminDocuments?: PatientWorkspaceAdminDocumentRow[];
  initialAuditTrail?: AuditTrailState | null;
  canEditClinical: boolean;
  canIssue: boolean;
  canManageAdminDocuments: boolean;
};

function buildAuditState(
  auditTrail: Awaited<ReturnType<typeof loadPatientWorkspaceTabPanel>>["auditTrail"]
): AuditTrailState | null {
  if (!auditTrail) return null;
  return {
    data: auditTrail.data,
    error: auditTrail.error ?? null,
    nextCursor: auditTrail.nextCursor ?? null,
    hasMore: auditTrail.hasMore ?? false,
  };
}

export function PatientWorkspaceShell({
  clinic,
  patient,
  patientRecord,
  patientId,
  initialTab,
  initialWorkspace,
  initialAdminDocuments = [],
  initialAuditTrail = null,
  canEditClinical,
  canIssue,
  canManageAdminDocuments,
}: Props) {
  const { activeTab, setTab } = usePatientWorkspaceTab(patientId, initialTab);
  const [pending, startTransition] = useTransition();
  const [tabCache, setTabCache] = useState<Record<string, TabCacheEntry>>(() => ({
    [initialTab]: {
      workspace: initialWorkspace,
      adminDocuments: initialAdminDocuments,
      auditTrail: initialAuditTrail,
    },
  }));
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (tabCache[activeTab]) return;

    let cancelled = false;
    startTransition(async () => {
      setLoadError(null);
      const result = await loadPatientWorkspaceTabPanel(patientId, activeTab);
      if (cancelled) return;

      if (result.error || !result.workspace) {
        setLoadError(result.error ?? "No se pudo cargar la sección");
        return;
      }

      setTabCache((prev) => {
        if (prev[activeTab]) return prev;
        return {
          ...prev,
          [activeTab]: {
            workspace: result.workspace!,
            adminDocuments: result.adminDocuments,
            auditTrail: buildAuditState(result.auditTrail),
          },
        };
      });
    });

    return () => {
      cancelled = true;
    };
  }, [activeTab, patientId, tabCache]);

  const current = tabCache[activeTab]?.workspace ?? initialWorkspace;
  const currentAuditTrail = tabCache[activeTab]?.auditTrail ?? null;
  const chartFocus = chartFocusForTab(activeTab);
  const panelLoading = pending && !tabCache[activeTab];

  const activePanel = useMemo(() => {
    const currentAdminDocuments = tabCache[activeTab]?.adminDocuments ?? [];
    if (panelLoading) return <PatientWorkspacePanelSkeleton />;
    if (loadError) {
      return <p className="text-sm text-red-600">{loadError}</p>;
    }

    switch (activeTab) {
      case "resumen":
        return (
          <ClinicalWorkspaceView
            patient={current.patient}
            chart={current.chart}
            patientId={patientId}
            canEditClinical={canEditClinical}
            canIssue={canIssue}
            professionals={current.professionals}
            defaultProfessionalId={current.defaultProfessionalId}
            lastMedications={current.lastMedications}
            clinicalDocuments={current.clinicalDocuments}
            appointments={current.appointments}
            portalSlug={current.portalSlug}
            doctorInfo={current.doctorInfo}
            patientShare={current.patientShare}
            regularMedication={current.patient.regular_medication}
            ehr={current.ehr}
            lastEvolution={current.ehr.consultations[0]?.evolution}
            lastDiagnosis={current.ehr.diagnosisRows[0]?.name}
          />
        );
      case "soap":
        return (
          <PatientSoapWorkspace
            embedded
            patient={current.ehr.patientInfo}
            consultations={current.ehr.consultations}
            diagnosisRows={current.ehr.diagnosisRows}
            treatmentRows={current.ehr.treatmentRows}
            attachments={current.ehr.attachments}
            prescriptions={current.ehr.prescriptions}
            totalConsultations={current.ehr.totalConsultations}
            usesHceExport={current.ehr.usesHceExport}
            patientRecord={patientRecord}
            professionals={current.professionals}
            templates={current.templates}
            defaultProfessionalId={current.defaultProfessionalId}
            clinicalRecordsPagination={current.ehr.clinicalRecordsPagination}
          />
        );
      case "diagnosticos":
        return <PatientWorkspaceDiagnosticsPanel ehr={current.ehr} patientId={patientId} />;
      case "recetas":
        return (
          <PatientWorkspacePrescriptionsPanel
            ehr={current.ehr}
            patientId={patientId}
            patient={patient}
            clinic={clinic}
            professionals={current.professionals}
            canIssue={canIssue}
          />
        );
      case "ordenes":
        return (
          <PatientWorkspaceOrdersPanel
            ehr={current.ehr}
            patientId={patientId}
            patient={patient}
            clinic={clinic}
            professionals={current.professionals}
            canIssue={canIssue}
          />
        );
      case "timeline":
        return <PatientWorkspaceTimelinePanel ehr={current.ehr} />;
      case "docs_admin":
        return canManageAdminDocuments ? (
          <PatientWorkspaceAdminDocsPanel
            patientId={patientId}
            patientLabel={`${patient.last_name}, ${patient.first_name} — ${patient.document_number}`}
            documents={currentAdminDocuments}
          />
        ) : null;
      case "auditoria":
        return (
          <PatientClinicalAuditPanel
            patientId={patientId}
            initialEvents={currentAuditTrail?.data}
            initialError={currentAuditTrail?.error ?? null}
            initialNextCursor={currentAuditTrail?.nextCursor ?? null}
            initialHasMore={currentAuditTrail?.hasMore ?? false}
          />
        );
      default:
        if (chartFocus) {
          return (
            <PatientWorkspaceChartPanel
              focus={chartFocus}
              patient={current.patient}
              chart={current.chart}
              patientId={patientId}
              canEditClinical={canEditClinical}
              canIssue={canIssue}
              professionals={current.professionals}
              defaultProfessionalId={current.defaultProfessionalId}
              lastMedications={current.lastMedications}
              regularMedication={current.patient.regular_medication}
              clinicalDocuments={current.clinicalDocuments}
            />
          );
        }
        return null;
    }
  }, [
    activeTab,
    canEditClinical,
    canIssue,
    canManageAdminDocuments,
    chartFocus,
    clinic,
    current,
    currentAuditTrail,
    loadError,
    panelLoading,
    patient,
    patientId,
    patientRecord,
    tabCache,
  ]);

  return (
    <PatientWorkspaceView
      activeTab={activeTab}
      onTabChange={setTab}
      activePanel={activePanel}
      ehr={current.ehr}
      patient={current.patient}
      patientId={patientId}
      chart={current.chart}
      canEditClinical={canEditClinical}
      canIssue={canIssue}
      professionals={current.professionals}
      defaultProfessionalId={current.defaultProfessionalId}
      lastMedications={current.lastMedications}
      regularMedication={current.patient.regular_medication}
      clinicalDocuments={current.clinicalDocuments}
      appointments={current.appointments}
      portalSlug={current.portalSlug}
      doctorInfo={current.doctorInfo}
      patientShare={current.patientShare}
      templates={current.templates}
      patientRecord={patientRecord}
      canManageAdminDocuments={canManageAdminDocuments}
    />
  );
}
