import { format, isValid, parseISO } from "date-fns";

import { formatAgeLabel } from "@/features/pacientes/utils/patient-age";

import { insuranceNumberLabel } from "@/lib/constants/coverages";

type Props = {
  birthDate?: string | null;
  insuranceNumber?: string | null;
  insuranceProvider?: string | null;
};

function formatBirthDate(birthDate: string | null | undefined): string {
  if (!birthDate) return "—";
  const date = parseISO(birthDate);
  if (!isValid(date)) return "—";
  return format(date, "dd/MM/yyyy");
}

export function PatientHeaderIdentity({ birthDate, insuranceNumber, insuranceProvider }: Props) {
  const age = formatAgeLabel(birthDate) ?? "—";
  const affiliateLabel = insuranceNumberLabel(insuranceProvider);
  const affiliate = insuranceNumber?.trim() || "—";

  return (
    <dl className="flex flex-wrap items-end gap-x-6 gap-y-1 text-sm">
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Nacimiento</dt>
        <dd className="font-semibold text-slate-100">{formatBirthDate(birthDate)}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Edad</dt>
        <dd className="font-semibold text-slate-100">{age}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{affiliateLabel}</dt>
        <dd className="font-semibold text-slate-100">{affiliate}</dd>
      </div>
    </dl>
  );
}
