"use client";

import { FileText, ScrollText } from "lucide-react";
import Link from "next/link";
import { memo, useCallback } from "react";

import { patientClinicalHistoryPath } from "@/shared/utils/clinical-navigation";

import {
  buildPatientContextMenuItems,
  openClinicalContextMenu,
} from "@/features/ia/components/clinical-workflow/clinical-context-menu";
import { PatientAppShareControl } from "@/features/pacientes/components/pacientes/patient-app-share-control";
import { PatientWhatsAppButton } from "@/features/pacientes/components/pacientes/patient-whatsapp-button";
import { isPamiPatient } from "@/features/pacientes/utils/patient-age";
import { formatPatientConsultationCountShort } from "@/features/pacientes/utils/patient-consultation-count";
import { buildPatientContactMessage } from "@/features/pacientes/utils/patient-messages";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

import { Badge } from "@/components/ui/badge";
import type { DoctorShareInfo } from "@/lib/utils/doctor-share-info";

export type PatientListRow = {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  insurance_provider: string | null;
  ageLabel: string | null;
  consultationCount: number;
};

type ShareMeta = {
  sharedAt: string;
  sharedByName?: string | null;
  channel?: string | null;
};

interface PatientListCardProps {
  patient: PatientListRow;
  portalSlug?: string | null;
  doctorInfo?: DoctorShareInfo | null;
  shareMeta?: ShareMeta | null;
  canIssuePrescriptions?: boolean;
}

const PatientListCard = memo(function PatientListCard({
  patient: p,
  portalSlug,
  doctorInfo,
  shareMeta,
  canIssuePrescriptions,
}: PatientListCardProps) {
  const patientDisplay = `${p.last_name}, ${p.first_name}`;
  const contact = p.phone ?? p.email ?? null;
  const metaParts = [
    `DNI ${p.document_number}`,
    p.ageLabel ?? null,
    contact,
    p.insurance_provider ?? "Sin obra social",
  ].filter(Boolean);
  const contactMessage = buildPatientContactMessage(`${p.first_name} ${p.last_name}`);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      openClinicalContextMenu(
        e,
        buildPatientContextMenuItems(p.id, { canIssue: canIssuePrescriptions })
      );
    },
    [p.id, canIssuePrescriptions]
  );

  return (
    <article
      className="drflow-card-light flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm ring-1 ring-slate-100/80 sm:flex-row sm:items-center sm:gap-4"
      onContextMenu={handleContextMenu}
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">{patientDisplay}</p>
        <p className="mt-0.5 text-xs text-slate-700">{metaParts.join(" · ")}</p>
        {isPamiPatient(p.insurance_provider) ? (
          <p className="mt-1.5">
            <Badge variant="teal">PAMI</Badge>
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:items-end">
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {portalSlug && doctorInfo ? (
            <PatientAppShareControl
              patientId={p.id}
              patientName={`${p.first_name} ${p.last_name}`}
              patientPhone={p.phone}
              slug={portalSlug}
              doctor={doctorInfo}
              share={shareMeta ?? null}
              compact
            />
          ) : null}
          <PatientWhatsAppButton phone={p.phone} message={contactMessage} size="icon" />
          <Link
            href={patientClinicalHistoryPath(p.id)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:from-cyan-700 hover:to-teal-700"
          >
            <FileText className="h-3.5 w-3.5" />
            Historia clínica
          </Link>
          {canIssuePrescriptions ? (
            <Link
              href={buildPatientWorkspaceUrl(p.id, { tab: "recetas", action: "nueva" })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100"
            >
              <ScrollText className="h-3.5 w-3.5" />
              Receta
            </Link>
          ) : null}
          <Link
            href={`/pacientes/${p.id}`}
            className="text-xs font-semibold text-slate-800 underline-offset-2 hover:text-teal-800 hover:underline"
          >
            Ficha
          </Link>
          <Link
            href={`/pacientes/${p.id}/editar`}
            className="text-xs font-semibold text-slate-800 underline-offset-2 hover:text-teal-800 hover:underline"
          >
            Editar
          </Link>
        </div>
        <p className="text-xs font-medium text-slate-700 sm:text-right">
          {formatPatientConsultationCountShort(p.consultationCount)}
        </p>
      </div>
    </article>
  );
});

interface Props {
  patients: PatientListRow[];
  portalSlug?: string | null;
  doctorInfo?: DoctorShareInfo | null;
  shareByPatient?: Map<string, ShareMeta>;
  canIssuePrescriptions?: boolean;
}

/** Misma fila blanca que Historia clínica (`ClinicalRecordsGroupedList`). */
export function PatientsListCards({
  patients,
  portalSlug,
  doctorInfo,
  shareByPatient,
  canIssuePrescriptions,
}: Props) {
  if (patients.length === 0) return null;

  return (
    <div className="drflow-card-light space-y-3 text-slate-900">
      {patients.map((p) => (
        <PatientListCard
          key={p.id}
          patient={p}
          portalSlug={portalSlug}
          doctorInfo={doctorInfo}
          shareMeta={shareByPatient?.get(p.id) ?? null}
          canIssuePrescriptions={canIssuePrescriptions}
        />
      ))}
    </div>
  );
}
