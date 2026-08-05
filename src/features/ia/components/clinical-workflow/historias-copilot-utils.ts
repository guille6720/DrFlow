import type { PatientRecordGroup } from "@/features/historias/components/historias/clinical-records-grouped-list";

import type { ClinicalCopilotContext } from "@/lib/utils/clinical-copilot";

export function buildHistoriasCopilotContextFromGroup(
  group: PatientRecordGroup
): ClinicalCopilotContext {
  const patientName = `${group.lastName}, ${group.firstName}`;
  const recentConsultations = group.records.slice(0, 5).map((record) => ({
    dateLabel: new Date(record.created_at).toLocaleDateString("es-AR"),
    motive: record.chief_complaint?.trim() || "Consulta",
    diagnosis: record.diagnosis?.trim() || "",
  }));

  const latest = group.records[0];

  return {
    patientId: group.patientId,
    patientName,
    lastConsultAt: latest?.created_at ?? null,
    recentConsultations,
    assistContext: {
      patientName,
      chiefComplaint: latest?.chief_complaint ?? null,
      diagnosis: latest?.diagnosis ?? null,
      activeProblems: group.records
        .map((record) => record.diagnosis?.trim())
        .filter(Boolean)
        .slice(0, 6) as string[],
    },
  };
}

export function resolveHistoriasCopilotFocusGroup(
  groups: PatientRecordGroup[],
  singlePatientFromSearch: string | null | undefined
): PatientRecordGroup | null {
  if (singlePatientFromSearch) {
    return groups.find((group) => group.patientId === singlePatientFromSearch) ?? null;
  }
  if (groups.length === 1) return groups[0];
  return null;
}
