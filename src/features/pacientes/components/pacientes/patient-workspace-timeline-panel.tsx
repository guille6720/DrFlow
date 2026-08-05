"use client";

import { PatientClinicalTimeline } from "@/features/pacientes/components/pacientes/patient-clinical-timeline";
import type { PatientEhrWorkspaceData } from "@/features/pacientes/server/load-patient-ehr-data";

export function PatientWorkspaceTimelinePanel({ ehr }: { ehr: PatientEhrWorkspaceData }) {
  return <PatientClinicalTimeline ehr={ehr} />;
}
