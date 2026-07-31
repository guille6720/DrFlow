"use client";

import Link from "next/link";
import { PatientWhatsAppButton } from "@/components/ui/patient-whatsapp-button";
import { buildPatientContactMessage } from "@/lib/utils/patient-messages";
import { Badge } from "@/components/ui/badge";
import { PatientAppShareControl } from "@/components/pacientes/patient-app-share-control";
import { isPamiPatient } from "@/lib/utils/patient-age";
import type { DoctorShareInfo } from "@/lib/utils/doctor-share-info";
import { FileText } from "lucide-react";

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
};

type ShareMeta = {
  sharedAt: string;
  sharedByName?: string | null;
  channel?: string | null;
};

interface Props {
  patients: PatientListRow[];
  portalSlug?: string | null;
  doctorInfo?: DoctorShareInfo | null;
  shareByPatient?: Map<string, ShareMeta>;
}

/** Misma fila blanca que Historia clínica (`ClinicalRecordsGroupedList`). */
export function PatientsListCards({
  patients,
  portalSlug,
  doctorInfo,
  shareByPatient,
}: Props) {
  if (patients.length === 0) return null;

  return (
    <div className="drflow-card-light space-y-3 text-slate-900">
      {patients.map((p) => {
        const patientDisplay = `${p.last_name}, ${p.first_name}`;
        const contact = p.phone ?? p.email ?? null;
        const metaParts = [
          `DNI ${p.document_number}`,
          p.ageLabel ?? null,
          contact,
          p.insurance_provider ?? "Sin obra social",
        ].filter(Boolean);

        return (
          <article
            key={p.id}
            className="drflow-card-light flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm ring-1 ring-slate-100/80 sm:flex-row sm:items-center sm:gap-4"
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

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {portalSlug && doctorInfo ? (
                <PatientAppShareControl
                  patientId={p.id}
                  patientName={`${p.first_name} ${p.last_name}`}
                  patientPhone={p.phone}
                  slug={portalSlug}
                  doctor={doctorInfo}
                  share={shareByPatient?.get(p.id) ?? null}
                  compact
                />
              ) : null}
              <PatientWhatsAppButton
                phone={p.phone}
                message={buildPatientContactMessage(`${p.first_name} ${p.last_name}`)}
                size="icon"
              />
              <Link
                href={`/historias/paciente/${p.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:from-cyan-700 hover:to-teal-700"
              >
                <FileText className="h-3.5 w-3.5" />
                Historia clínica
              </Link>
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
          </article>
        );
      })}
    </div>
  );
}
