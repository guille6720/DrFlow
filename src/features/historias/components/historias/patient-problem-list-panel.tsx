import Link from "next/link";

import { withClinicalHistoryReturn } from "@/shared/utils/clinical-navigation";

import type { PatientProblemListItem } from "@/features/pacientes/server/load-clinical-structure";

type Props = {
  patientId: string;
  problems: PatientProblemListItem[];
};

export function PatientProblemListPanel({ patientId, problems }: Props) {
  if (problems.length === 0) return null;

  return (
    <section className="mb-4 overflow-hidden rounded-sm border border-[var(--border)]">
      <h3 className="border-b border-[var(--border)] px-3 py-2 text-sm font-bold">
        Problemas activos
      </h3>
      <ul className="divide-y divide-[var(--border)] text-xs">
        {problems.map((problem) => (
          <li key={problem.id} className="flex items-start justify-between gap-3 px-3 py-2">
            <div>
              <p className="font-medium text-[var(--foreground)]">{problem.name}</p>
              {problem.cie10_code ? (
                <p className="mt-0.5 text-[var(--muted-foreground)]">CIE-10 {problem.cie10_code}</p>
              ) : null}
            </div>
            {problem.source_clinical_record_id ? (
              <Link
                href={withClinicalHistoryReturn(
                  `/historias/${problem.source_clinical_record_id}`,
                  patientId
                )}
                className="shrink-0 text-[var(--primary)] hover:underline"
              >
                Ver
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
