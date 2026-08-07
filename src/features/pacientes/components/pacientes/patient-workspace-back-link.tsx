"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  LEGACY_TAB_ALIASES,
  parsePatientWorkspaceTab,
} from "@/features/pacientes/constants/patient-workspace-tabs";
import { patientWorkspaceBackHref } from "@/features/pacientes/utils/patient-workspace-back-href";

type Props = {
  patientId: string;
  initialFrom?: string;
  returnPatientId?: string;
};

export function PatientWorkspaceBackLink({ patientId, initialFrom, returnPatientId }: Props) {
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab = parsePatientWorkspaceTab(rawTab ? (LEGACY_TAB_ALIASES[rawTab] ?? rawTab) : null);

  const href = patientWorkspaceBackHref(patientId, activeTab, {
    from: searchParams.get("from") ?? initialFrom,
    returnPatientId,
    record: searchParams.get("record"),
    action: searchParams.get("action"),
    sheet: searchParams.get("sheet"),
    mode: searchParams.get("mode"),
    focus: searchParams.get("focus"),
  });

  return (
    <Link href={href} className="drflow-link inline-flex items-center gap-1 text-sm">
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Volver
    </Link>
  );
}
