"use client";

import Link from "next/link";

import { patientClinicalHistoryPath } from "@/shared/utils/clinical-navigation";

import { PatientWhatsAppButton } from "@/features/pacientes/components/pacientes/patient-whatsapp-button";
import { buildPatientContactMessage } from "@/features/pacientes/utils/patient-messages";

type Props = {
  patientId: string;
  phone: string | null;
  whatsappName: string;
};

/** Prevents `<details>` summary toggle when interacting with action links. */
export function ClinicalRecordsGroupSummaryActions({ patientId, phone, whatsappName }: Props) {
  return (
    <div
      className="flex shrink-0 items-center gap-2"
      onClick={(e) => e.preventDefault()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <PatientWhatsAppButton
        phone={phone}
        message={buildPatientContactMessage(whatsappName)}
        size="icon"
      />
      <Link
        href={patientClinicalHistoryPath(patientId)}
        className="rounded-lg bg-gradient-to-r from-cyan-600 to-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:from-cyan-700 hover:to-teal-700"
        onClick={(e) => e.stopPropagation()}
      >
        Toda su historia
      </Link>
      <Link
        href={`/pacientes/${patientId}`}
        className="text-xs text-slate-600 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        Ficha
      </Link>
    </div>
  );
}
