"use client";

import { Copy } from "lucide-react";

import { copyTextToClipboard } from "@/core/browser/copy-to-clipboard";
import { toast } from "@/core/notifications/toast";

import { cn } from "@/shared/utils/cn";

import { buttonSurfaceClassName } from "@/components/ui/button";
import { formatPamiPatientClipboard } from "@/lib/integrations/pami/patient-context";
import type { PamiPatientContext } from "@/lib/integrations/pami/types";

export const integrationMutedText = "text-[var(--text-muted,var(--muted-foreground))]";
const text = "text-[var(--text-on-card,var(--foreground))]";

/** Clipboard writes only happen from an explicit click; nothing is copied or sent automatically. */
async function copyValue(value: string) {
  const result = await copyTextToClipboard(value);
  if (result.ok) toast.copySuccess("Datos copiados");
  else toast.error(result.message);
}

export function CopyPatientDataButton({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => void copyValue(value)}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg sm:h-8 sm:w-8",
        integrationMutedText,
        "hover:bg-[var(--surface-hover,var(--muted))] hover:text-[var(--text-primary,var(--foreground))]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      )}
    >
      <Copy className="h-4 w-4" aria-hidden />
    </button>
  );
}

function Field({
  label,
  value,
  copyLabel,
  copyText,
  emphasized,
}: {
  label: string;
  value: string | null;
  copyLabel?: string;
  copyText?: string | null;
  emphasized?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <dt className={cn("text-[11px] uppercase tracking-wide", integrationMutedText)}>{label}</dt>
        <dd className={cn("break-words text-sm", emphasized ? "font-bold" : "font-medium", text)}>{value}</dd>
      </div>
      {copyLabel ? <CopyPatientDataButton value={copyText ?? value} label={copyLabel} /> : null}
    </div>
  );
}

type Props = {
  patient: PamiPatientContext;
  /** Accessible name of the section, e.g. "Datos del paciente para copiar en RCTA o PAMI". */
  label: string;
};

/** Read-only identification + coverage data for manual copy into external systems. */
export function PatientIntegrationContext({ patient, label }: Props) {
  const docLabel =
    patient.documentType && patient.documentType.toUpperCase() !== "DNI" ? patient.documentType : "DNI";
  return (
    <section
      aria-label={label}
      className="rounded-xl border border-[var(--border-default,var(--border))] bg-[var(--surface-muted,var(--muted))]/40 p-3"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className={cn("text-[11px] uppercase tracking-wide", integrationMutedText)}>Paciente</p>
          <p className={cn("break-words text-sm font-semibold", text)}>{patient.fullName}</p>
        </div>
        <button
          type="button"
          onClick={() => void copyValue(formatPamiPatientClipboard(patient))}
          className={buttonSurfaceClassName("ghost", "sm", "shrink-0")}
        >
          <Copy className="h-4 w-4" aria-hidden />
          Copiar datos del paciente
        </button>
      </div>
      <dl className="grid gap-2 sm:grid-cols-2">
        <Field
          label={docLabel}
          value={patient.documentNumberFormatted}
          copyLabel={`Copiar ${docLabel}`}
          copyText={patient.documentNumber}
        />
        <Field label="CUIL" value={patient.cuilFormatted} copyLabel="Copiar CUIL" copyText={patient.cuil} />
        <Field label="Nacimiento" value={patient.birthDate} />
        <Field label="Sexo" value={patient.sex} />
        <Field
          label="Cobertura"
          value={patient.pamiCoverage ? "PAMI" : patient.insuranceProvider}
          emphasized={patient.pamiCoverage}
        />
        <Field
          label={patient.pamiCoverage ? "N° afiliado PAMI" : "Afiliado"}
          value={patient.insuranceNumber}
          copyLabel="Copiar número de afiliado"
        />
      </dl>
    </section>
  );
}
