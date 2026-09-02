"use client";

import Link from "next/link";

import { patientClinicalHistoryPath, patientFichaPath } from "@/shared/utils/clinical-navigation";

import type { PatientRecordGroup } from "@/features/historias/components/historias/clinical-records-grouped-list";
import { ClinicalCopilotAccessButton } from "@/features/ia/components/clinical-workflow/clinical-copilot-access-button";
import { buildHistoriasCopilotContextFromGroup } from "@/features/ia/components/clinical-workflow/historias-copilot-utils";
import { PatientWhatsAppButton } from "@/features/pacientes/components/pacientes/patient-whatsapp-button";
import { buildPatientContactMessage } from "@/features/pacientes/utils/patient-messages";

type Props = {
  group: PatientRecordGroup;
  whatsappName: string;
};

/** Prevents `<details>` summary toggle when interacting with action links. */
export function ClinicalRecordsGroupSummaryActions({ group, whatsappName }: Props) {
  const copilotContext = buildHistoriasCopilotContextFromGroup(group);

  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-2"
      onClick={(e) => e.preventDefault()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <ClinicalCopilotAccessButton
        label="IA"
        size="sm"
        variant="outline"
        context={copilotContext}
        className="border-violet-200 bg-violet-50/80 px-2 text-violet-900 hover:bg-violet-100"
      />
      <PatientWhatsAppButton
        phone={group.phone}
        message={buildPatientContactMessage(whatsappName)}
        size="icon"
      />
      <Link
        href={patientClinicalHistoryPath(group.patientId)}
        prefetch
        className="rounded-lg drflow-accent-fill px-3 py-1.5 text-xs font-semibold text-white"
        onClick={(e) => e.stopPropagation()}
      >
        Toda su historia
      </Link>
      <Link
        href={patientFichaPath(group.patientId)}
        prefetch
        className="text-xs text-slate-600 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        Ficha
      </Link>
    </div>
  );
}
