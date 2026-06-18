import { Badge } from "@/components/ui/badge";
import { calculateAge, formatAgeLabel, isPamiPatient } from "@/lib/utils/patient-age";
import { AlertTriangle, Pill, Heart } from "lucide-react";
import type { Patient } from "@/types/database";

interface PamiPatientBannerProps {
  patient: Pick<
    Patient,
    | "first_name"
    | "last_name"
    | "birth_date"
    | "insurance_provider"
    | "insurance_number"
    | "allergies"
    | "regular_medication"
    | "emergency_contact_name"
    | "emergency_contact_phone"
  >;
}

export function PamiPatientBanner({ patient }: PamiPatientBannerProps) {
  const age = calculateAge(patient.birth_date);
  const ageLabel = formatAgeLabel(patient.birth_date);
  const isPami = isPamiPatient(patient.insurance_provider);
  const isGeriatric = age !== null && age >= 65;

  return (
    <div className="rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-50/80 to-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {isPami && (
              <Badge variant="teal" className="font-semibold">
                PAMI
              </Badge>
            )}
            {ageLabel && (
              <Badge variant="default">{ageLabel}</Badge>
            )}
            {isGeriatric && (
              <Badge variant="warning">Adulto mayor</Badge>
            )}
          </div>
          {patient.insurance_number && (
            <p className="mt-2 text-sm text-slate-600">
              N° beneficio: <span className="font-medium text-slate-900">{patient.insurance_number}</span>
            </p>
          )}
          {(patient.emergency_contact_name || patient.emergency_contact_phone) && (
            <p className="mt-1 text-xs text-slate-500">
              Contacto: {patient.emergency_contact_name ?? "—"}
              {patient.emergency_contact_phone ? ` · ${patient.emergency_contact_phone}` : ""}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {patient.allergies && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Alergias:</strong> {patient.allergies}
            </span>
          </div>
        )}
        {patient.regular_medication && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <Pill className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Medicación:</strong> {patient.regular_medication}
            </span>
          </div>
        )}
        {!patient.allergies && !patient.regular_medication && (
          <div className="flex items-center gap-2 text-sm text-slate-500 sm:col-span-2">
            <Heart className="h-4 w-4" />
            Completá alergias y medicación habitual en la ficha del paciente.
          </div>
        )}
      </div>
    </div>
  );
}
