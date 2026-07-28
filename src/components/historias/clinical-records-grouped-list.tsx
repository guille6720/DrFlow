"use client";

import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronDown } from "lucide-react";
import { PatientWhatsAppButton } from "@/components/ui/patient-whatsapp-button";
import { buildPatientContactMessage } from "@/lib/utils/patient-messages";
import { sanitizeClinicalDisplayText } from "@/lib/utils/sanitize-clinical-display";

export type GroupedClinicalRecord = {
  id: string;
  created_at: string;
  diagnosis: string | null;
  chief_complaint: string | null;
  professional_name: string;
};

export type PatientRecordGroup = {
  patientId: string;
  firstName: string;
  lastName: string;
  documentNumber: string;
  phone: string | null;
  records: GroupedClinicalRecord[];
  totalForPatient: number;
};

interface Props {
  groups: PatientRecordGroup[];
  defaultOpenPatientId?: string | null;
}

export function ClinicalRecordsGroupedList({ groups, defaultOpenPatientId }: Props) {
  if (groups.length === 0) return null;

  return (
    <div className="drflow-card-light space-y-3">
      {groups.map((group) => {
        const openByDefault =
          groups.length === 1 || group.patientId === defaultOpenPatientId;
        const patientDisplay = `${group.lastName}, ${group.firstName}`;
        const whatsappName = `${group.firstName} ${group.lastName}`;

        return (
          <details
            key={group.patientId}
            open={openByDefault}
            className="group rounded-xl border border-slate-200 bg-white shadow-sm open:ring-1 open:ring-blue-100"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-180" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{patientDisplay}</p>
                <p className="text-xs text-slate-500">
                  DNI {group.documentNumber} · {group.totalForPatient} consulta(s) en total
                  {group.records.length < group.totalForPatient
                    ? ` · mostrando ${group.records.length} en esta página`
                    : ""}
                </p>
              </div>
              <div
                className="flex shrink-0 items-center gap-2"
                onClick={(e) => e.preventDefault()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <PatientWhatsAppButton
                  phone={group.phone}
                  message={buildPatientContactMessage(whatsappName)}
                  size="icon"
                />
                <Link
                  href={`/historias/paciente/${group.patientId}`}
                  className="rounded-lg bg-gradient-to-r from-cyan-600 to-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:from-cyan-700 hover:to-teal-700"
                  onClick={(e) => e.stopPropagation()}
                >
                  Toda su historia
                </Link>
                <Link
                  href={`/pacientes/${group.patientId}`}
                  className="text-xs text-slate-600 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Ficha
                </Link>
              </div>
            </summary>

            <ul className="divide-y divide-slate-100 border-t border-slate-100 px-2 pb-2">
              {group.records.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-1 py-3 pl-8 pr-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      {format(new Date(r.created_at), "PPP", { locale: es })}
                      <span className="font-normal text-slate-500">
                        {" "}
                        · {format(new Date(r.created_at), "p", { locale: es })}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">{r.professional_name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {sanitizeClinicalDisplayText(r.diagnosis ?? r.chief_complaint) || "Sin diagnóstico"}
                    </p>
                  </div>
                  <Link
                    href={`/historias/${r.id}`}
                    className="shrink-0 text-sm font-medium text-blue-700 hover:underline"
                  >
                    Ver detalle
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
