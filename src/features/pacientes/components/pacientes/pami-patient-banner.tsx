import { AlertTriangle, Heart, Pill } from "lucide-react";

import { calculateAge, formatAgeLabel, isPamiPatient } from "@/features/pacientes/utils/patient-age";
import { getPamiMessages } from "@/features/pami/i18n";

import { Badge } from "@/components/ui/badge";
import { insuranceNumberLabel } from "@/lib/constants/coverages";

interface PamiPatientBannerProps {
  patient: {
    first_name: string;
    last_name: string;
    birth_date?: string | null;
    insurance_provider?: string | null;
    insurance_number?: string | null;
    allergies?: string | null;
    regular_medication?: string | null;
    emergency_contact_name?: string | null;
    emergency_contact_phone?: string | null;
  };
}

export function PamiPatientBanner({ patient }: PamiPatientBannerProps) {
  const t = getPamiMessages().patientBanner;
  const age = calculateAge(patient.birth_date);
  const ageLabel = formatAgeLabel(patient.birth_date);
  const isPami = isPamiPatient(patient.insurance_provider);
  const isGeriatric = age !== null && age >= 65;
  const numberLabel = insuranceNumberLabel(patient.insurance_provider);

  return (
    <section
      className="drflow-patient-context-banner rounded-2xl border border-blue-200/80 bg-gradient-to-r from-blue-50/80 to-white p-4 shadow-sm"
      aria-label={t.ariaLabel}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {isPami && (
              <Badge variant="teal" className="font-semibold">
                {t.badgePami}
              </Badge>
            )}
            {!isPami && patient.insurance_provider && (
              <Badge variant="default">{patient.insurance_provider}</Badge>
            )}
            {ageLabel && <Badge variant="default">{ageLabel}</Badge>}
            {isGeriatric && <Badge variant="warning">{t.badgeGeriatric}</Badge>}
          </div>
          {patient.insurance_number ? (
            <p className="drflow-patient-banner-meta mt-2 text-sm">
              {numberLabel}:{" "}
              <span className="font-semibold text-slate-900">{patient.insurance_number}</span>
            </p>
          ) : patient.insurance_provider ? (
            <p className="drflow-patient-banner-meta mt-2 text-sm">
              {numberLabel}: <span className="italic">{t.noNumber}</span>
            </p>
          ) : null}
          {(patient.emergency_contact_name || patient.emergency_contact_phone) && (
            <p className="drflow-patient-banner-meta mt-1 text-xs">
              {t.contact} {patient.emergency_contact_name ?? "—"}
              {patient.emergency_contact_phone ? ` · ${patient.emergency_contact_phone}` : ""}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {patient.allergies && (
          <div
            className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              <strong>{t.allergies}</strong> {patient.allergies}
            </span>
          </div>
        )}
        {patient.regular_medication && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <Pill className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              <strong>{t.medication}</strong> {patient.regular_medication}
            </span>
          </div>
        )}
        {!patient.allergies && !patient.regular_medication && (
          <div className="drflow-patient-banner-hint flex items-center gap-2 text-sm sm:col-span-2">
            <Heart className="h-4 w-4 shrink-0" aria-hidden />
            {t.completeHint}
          </div>
        )}
      </div>
    </section>
  );
}
